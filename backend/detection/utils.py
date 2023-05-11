import re
import statistics
from typing import Iterable, Optional


def is_mode_directory(mode: str) -> bool:
    return 'd/d' in mode


def is_name_filename(name: str) -> bool:
    # We can't check only at the end of the name, because if the file is deleted, it will end in ` (deleted)`
    return ' ($FILE_NAME)' in name


def remove_filename(name: str) -> str:
    if not is_name_filename(name):
        return name
    index = name.index(' ($FILE_NAME)')
    return f'{name[:index]}{name[index+len(" ($FILE_NAME)"):]}'


def aggregate_attribute_mean(attributes: Iterable[float]) -> Optional[float]:
    non_none_attrs = list(filter(lambda x: x is not None, attributes))
    if len(non_none_attrs) == 0:
        return None
    return statistics.mean(non_none_attrs)


def aggregate_attribute_mode(attributes: Iterable[any]) -> Optional[any]:
    non_none_attrs = list(filter(lambda x: x is not None, attributes))
    if len(non_none_attrs) == 0:
        return None
    return statistics.mode(non_none_attrs)


def path_to_regex(path: str) -> str:
    if path.endswith(' (deleted)'):
        index = path.index(' (deleted)')
    elif path.endswith(' (deleted-realloc)'):
        index = path.index(' (deleted-realloc)')
    else:
        index = len(path)
    path = f'{path[:index]} ($FILE_NAME){path[index:]}'
    escaped = re.escape(path)
    # re.escape does not escape /, so we escape in manually
    escaped = escaped.replace('/', '\\/')
    opening_index = escaped.index('\\ \\(\\$FILE_NAME\\)')
    closing_index = opening_index + len('\\ \\(\\$FILE_NAME\\)')
    final = f'{escaped[:opening_index]}({escaped[opening_index:closing_index]})?{escaped[closing_index:]}'
    return final
