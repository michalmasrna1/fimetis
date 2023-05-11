import numpy as np
import pandas as pd


TIMESTAMP_COLUMN_NAMES = ['FN_access', 'FN_modified', 'FN_changed', 'FN_birth',
                          'SI_access', 'SI_modified', 'SI_changed', 'SI_birth']
COLUMN_NAMES = [*TIMESTAMP_COLUMN_NAMES, 'size', 'owner', 'full_path']
NUMERIC_COLUMN_NAMES = [*TIMESTAMP_COLUMN_NAMES, 'size', 'owner']
LOGARITHMIC_COLUMN_NAMES = [*TIMESTAMP_COLUMN_NAMES, 'size']


def preprocess_csv(csv_path: str, max_time: int) -> pd.DataFrame:
    dataset = pd.read_csv(csv_path, sep=';', names=COLUMN_NAMES)

    if dataset.empty:
        return dataset

    # Filling missing values
    for column_name in NUMERIC_COLUMN_NAMES:
        dataset[column_name] = pd.to_numeric(dataset[column_name], errors='coerce')
        # If all fields in a column are NaN, we can't compute the median, so we fill it with 0
        # This will in no way affect the anomaly detection, since all values in this column will be the same (0)
        is_all_nan = np.isnan(dataset[column_name]).all()
        fill_value = 0 if is_all_nan else dataset[column_name].median()
        dataset[column_name].fillna(fill_value, inplace=True)

    # Timestamp transformation
    for column_name in TIMESTAMP_COLUMN_NAMES:
        dataset[column_name] = dataset[column_name].transform(lambda x: max_time - x + 60 * 60 * 24)

    # Logarithmic transformation
    for column_name in [*LOGARITHMIC_COLUMN_NAMES]:
        dataset[column_name] = np.log1p(dataset[column_name])

    # Owner transformation
    owner_frequencies = dataset['owner'].value_counts(normalize=True)
    dataset['owner_relative'] = dataset['owner'].transform(lambda owner_id: owner_frequencies[owner_id])
    dataset.drop('owner', axis=1, inplace=True)

    # Normalization
    for column_name in [*TIMESTAMP_COLUMN_NAMES, 'size']:
        max_value = dataset[column_name].max()
        # Avoid division by zero if max_value == 0
        fill_value = 0 if max_value == 0 else dataset[column_name] / max_value
        dataset[column_name] = fill_value

    for column_name in TIMESTAMP_COLUMN_NAMES:
        dataset[column_name] = (dataset[column_name] * 2) - 1

    return dataset
