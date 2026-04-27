#!/usr/bin/env python3
"""
KNN Risk Prediction Script
Predicts employee risk labels and scores using trained KNN model
"""

import argparse
import json
import pickle
import sys
import pandas as pd
from pathlib import Path


def load_model(model_dir):
    """Load the trained KNN model and feature columns"""
    model_path = Path(model_dir) / 'model.pkl'
    if not model_path.exists():
        model_path = Path(model_dir) / 'knn_risk_model.pkl'
    columns_path = Path(model_dir) / 'feature_columns.pkl'

    with open(model_path, 'rb') as f:
        model = pickle.load(f)

    with open(columns_path, 'rb') as f:
        feature_columns = pickle.load(f)

    return model, feature_columns


def predict_risk_fallback(features_list):
    """
    Rule-based fallback when pickle model cannot be loaded.
    Keeps API shape identical to model prediction output.
    """
    results = []
    for item in features_list:
        kpi = float(item.get('kpi_completion_rate', 0))
        sentiment = float(item.get('feedback_sentiment_score', item.get('average_sentiment_score', 0)))
        delay = float(item.get('checkin_delay_days', item.get('avg_delay_days', 0)))
        obj_ratio = float(item.get('objective_participation_ratio', 0))

        score = 0.0
        score += 0.40 * (1.0 - max(0.0, min(1.0, kpi)))
        score += 0.25 * max(0.0, min(1.0, (delay - 7.0) / 30.0))
        score += 0.20 * max(0.0, min(1.0, (-sentiment + 1.0) / 2.0))
        score += 0.15 * max(0.0, min(1.0, 1.0 - obj_ratio))

        if score >= 0.67:
            label = 'high'
            numeric = 1.0
        elif score >= 0.34:
            label = 'medium'
            numeric = 0.5
        else:
            label = 'low'
            numeric = 0.1

        results.append({
            'risk_label': label,
            'risk_score_numeric': numeric
        })

    return results


def predict_risk(model, feature_columns, features_list):
    """Predict risk for a list of feature dictionaries"""
    alias_map = {
        'average_sentiment_score': 'feedback_sentiment_score',
        'avg_delay_days': 'checkin_delay_days'
    }

    normalized_features = []
    for item in features_list:
        normalized = dict(item)
        for target_key, source_key in alias_map.items():
            if target_key not in normalized and source_key in normalized:
                normalized[target_key] = normalized[source_key]
        normalized_features.append(normalized)

    df = pd.DataFrame(normalized_features)

    missing_cols = set(feature_columns) - set(df.columns)
    if missing_cols:
        raise ValueError(f"Missing required features: {missing_cols}")

    X = df[feature_columns]
    predictions = model.predict(X)

    risk_mapping = {'low': 0.1, 'medium': 0.5, 'high': 1.0}

    results = []
    for pred in predictions:
        results.append({
            'risk_label': pred,
            'risk_score_numeric': risk_mapping.get(pred, 0.5)
        })

    return results


def main():
    parser = argparse.ArgumentParser(description='Predict employee risk using KNN model')
    parser.add_argument('--model-dir', required=True, help='Directory containing the model files')
    parser.add_argument('--features', required=True, help='JSON string of features to predict')

    args = parser.parse_args()

    try:
        features_list = json.loads(args.features)
        try:
            model, feature_columns = load_model(args.model_dir)
            predictions = predict_risk(model, feature_columns, features_list)
        except Exception as model_error:
            print(f"Warning: failed to load model, using fallback predictor: {str(model_error)}", file=sys.stderr)
            predictions = predict_risk_fallback(features_list)

        print(json.dumps(predictions))

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
