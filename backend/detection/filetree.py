import os
from tempfile import NamedTemporaryFile
from typing import Any, Dict, IO, Iterable, List, Optional

from .model import Model
from .utils import aggregate_attribute_mean, aggregate_attribute_mode


Timestamp = int


class Timestamps:
    def __init__(self, access: Optional[Timestamp], modified: Optional[Timestamp],
                 changed: Optional[Timestamp], birth: Optional[Timestamp]):
        self.access = access
        self.modified = modified
        self.changed = changed
        self.birth = birth

    def update_timestamps(self, timestamps_type: str, timestamp_value: int) -> None:
        """The timestamps_type is a string in format `macb` where some of the letters can be replaced by a dot (.)
        The timestamps corresponding to the timestamp types that are not a dot are updated to timestamp_value"""
        if timestamps_type[0] == 'm':
            self.modified = timestamp_value
        if timestamps_type[1] == 'a':
            self.access = timestamp_value
        if timestamps_type[2] == 'c':
            self.changed = timestamp_value
        if timestamps_type[3] == 'b':
            self.birth = timestamp_value


class Entry:
    """Represents a file, a directory, or an aggregated directory"""
    def __init__(self, path, fna: Optional[Timestamp] = None, fnm: Optional[Timestamp] = None,
                 fnc: Optional[Timestamp] = None, fnb: Optional[Timestamp] = None, sia: Optional[Timestamp] = None,
                 sim: Optional[Timestamp] = None, sic: Optional[Timestamp] = None, sib: Optional[Timestamp] = None,
                 size: int = None, owner: int = None):
        self.full_path = path
        self.FN_timestamps = Timestamps(fna, fnm, fnc, fnb)
        self.SI_timestamps = Timestamps(sia, sim, sic, sib)
        self.size = size
        self.owner = owner

    def get_timestamp_attributes(self) -> Iterable[Timestamp]:
        return self.FN_timestamps.access, self.FN_timestamps.modified, self.FN_timestamps.changed, \
            self.FN_timestamps.birth, self.SI_timestamps.access, self.SI_timestamps.modified, \
            self.SI_timestamps.changed, self.SI_timestamps.birth,

    def get_all_attributes(self) -> Iterable[Any]:
        return *self.get_timestamp_attributes(), self.size, self.owner, self.full_path

    def get_attributes_aggregable_by_mean(self) -> Iterable[Any]:
        return *self.get_timestamp_attributes(), self.size

    def get_attributes_aggregable_by_mode(self) -> Iterable[Any]:
        # We return a list to force one attribute to be an Iterable. If multiple attributes were to be returned
        # they can be returned in a Tuple as in get_attributes_aggregable_by_mean
        return [self.owner]

    def to_csv_line(self, delimiter: str = ';') -> str:
        # Returns all attributes separated by the delimiter
        # If any of the attributes contain the delimiter character, it is replaced with an empty string
        return delimiter.join(map(lambda x: str(x).replace(delimiter, ''), self.get_all_attributes()))


class Directory:
    """Represents one inner node in the Filetree"""
    def __init__(self, path: str):
        self.path = path
        self.directory_children: Dict[str, 'Directory'] = {}
        self.entries: Dict[str, Entry] = {}

    def aggregate(self) -> None:
        for directory_child in self.directory_children.values():
            directory_child.aggregate()
            attributes_list_mean = [entry.get_attributes_aggregable_by_mean()
                                    for entry in directory_child.entries.values()]
            aggregated_attributes_mean = (aggregate_attribute_mean(attrs) for attrs in zip(*attributes_list_mean))
            attributes_list_mode = [entry.get_attributes_aggregable_by_mode()
                                    for entry in directory_child.entries.values()]
            aggregated_attributes_mode = (aggregate_attribute_mode(attrs) for attrs in zip(*attributes_list_mode))
            aggregated_child = Entry(directory_child.path, *aggregated_attributes_mean, *aggregated_attributes_mode)
            self.entries[directory_child.path] = aggregated_child

    def to_csv(self, csv_file: IO) -> None:
        for entry in self.entries.values():
            print(entry.to_csv_line(';'), file=csv_file)

    def detect_outliers(self, model, max_time) -> List[str]:
        temporary_file = NamedTemporaryFile(mode='w+', delete=False)
        csv_path = temporary_file.name
        self.to_csv(temporary_file)
        temporary_file.close()
        outlier_paths = model.predict_outliers_in_csv(csv_path, max_time)
        os.remove(csv_path)
        return outlier_paths + [outlier for child in self.directory_children.values()
                                for outlier in child.detect_outliers(model, max_time)]


class Filetree:
    def __init__(self, root: Directory):
        self.root = root

    def retrieve_or_create_directory(self, path: str) -> Directory:
        """Returns the Directory with the given path. If any Directory along the path does not exist, it is created."""
        directories = path.split('/')
        parent = self.root
        directory_path = ''
        for directory in directories[1:]:
            directory_path += '/' + directory
            if directory_path in parent.directory_children:
                parent = parent.directory_children[directory_path]
            else:
                new_child = Directory(directory_path)
                parent.directory_children[directory_path] = new_child
                parent = new_child
        return parent

    def add_entry(self, entry: Entry) -> None:
        """Adds the entry to the tree and creates the Directories along the path if necessary."""
        directory_path = '/'.join(entry.full_path.split('/')[:-1])
        parent = self.retrieve_or_create_directory(directory_path)
        parent.entries[entry.full_path] = entry

    def locate_entry(self, path: str) -> Optional[Entry]:
        """Returns the Entry with the given path or None, if such Entry does not exist."""
        directories = path.split('/')[:-1]
        parent = self.root
        directory_path = ''
        for directory in directories[1:]:
            directory_path += '/' + directory
            if directory_path in parent.directory_children:
                parent = parent.directory_children[directory_path]
            else:
                return None
        if path in parent.entries:
            return parent.entries[path]
        return None

    def aggregate_directories(self) -> None:
        self.root.aggregate()

    def detect_outliers(self, model: Model, max_time: int) -> List[str]:
        return self.root.detect_outliers(model, max_time)
