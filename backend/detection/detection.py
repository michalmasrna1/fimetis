from datetime import datetime
from typing import List, Tuple

from .filetree import Directory, Entry, Filetree
from .model import Model
from .utils import is_mode_directory, is_name_filename, remove_filename


def create_filetree_and_max_time(stream) -> Tuple[Filetree, int]:
    """Creates a Filetree from a stream of lines"""
    filetree = Filetree(Directory('/'))
    max_time = 0
    for line in stream:
        # Convert the timestamp to an int representing the Unix epoch
        timestamp = int(datetime.fromisoformat(line['@timestamp'][:-1]).timestamp())

        # Ignore invalid lines
        if timestamp == 0:
            continue

        # Ignore directory entries
        if is_mode_directory(line['Mode']):
            continue

        name = line['File Name']

        # Does this line correspond to the $FN attribute?
        is_filename = is_name_filename(name)
        if is_filename:
            name = remove_filename(name)

        entry = filetree.locate_entry(name)
        if entry is None:
            # This is the first time we have encountered this file, so we create a new Entry
            entry = Entry(name)
            filetree.add_entry(entry)

        if not is_filename:
            # This line corresponds to the $SI attribute, so we use the owner and size values
            entry.owner = line['UID']
            entry.size = line['Size']

        timestamps_to_update = entry.FN_timestamps if is_filename else entry.SI_timestamps
        timestamps_to_update.update_timestamps(line['Type'], timestamp)

        max_time = max(max_time, timestamp)

    return filetree, max_time


def detect_outliers(stream, params) -> List[str]:
    filetree, max_time = create_filetree_and_max_time(stream)
    filetree.aggregate_directories()

    distance, z_score, std_ratio = params
    model = Model(distance, z_score, std_ratio)

    return filetree.detect_outliers(model, max_time)
