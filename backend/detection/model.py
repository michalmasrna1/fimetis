import numpy as np
import pandas as pd
import statistics
from typing import List

from .preprocessing import preprocess_csv


EPSILON = 2 ** (-16)
CONFIGURATIONS = {
    '1': (1.5, 2.35, 1.03),
    '2': (1.49, 2.35, 1.0015),
    '3': (1.39, 2.35, 1.001)
}


class Model:
    def __init__(self, distance: float, z_score: float, std_ratio: float):
        self.distance = distance
        self.z_score = z_score
        self.std_ratio = std_ratio

    def predict_outliers_in_csv(self, csv_path: str, max_time: int) -> List[str]:
        """Returns a list of paths of entries detected as outliers in .csv file provided in csv_path argument"""
        dataset = preprocess_csv(csv_path, max_time)
        full_paths = dataset['full_path']
        dataset.drop('full_path', axis=1, inplace=True)

        outlier_paths = []
        size = dataset.shape[0]

        if size < 3:
            return []

        mean = dataset.mean()
        dists = np.sqrt(np.sum((dataset - mean) ** 2, axis=1))
        # add EPSILON to avoid division by zero
        std = compute_std(dataset) + EPSILON

        for i in range(size):
            dist = dists[i]
            if dist > self.distance:
                z_score = dist / std
                if z_score > self.z_score:
                    # add EPSILON to avoid division by zero
                    std_without = compute_std(dataset.drop(dataset.iloc[[i]].index)) + EPSILON
                    std_ratio = std / std_without
                    if std_ratio > self.std_ratio:
                        outlier_paths.append(full_paths[i])

        return outlier_paths


def compute_std(dataset: pd.DataFrame) -> float:
    mean = dataset.mean()
    distances_from_mean = np.sqrt(np.sum((dataset - mean) ** 2, axis=1))
    variance = statistics.mean((distance ** 2 for distance in distances_from_mean))
    return np.sqrt(variance)
