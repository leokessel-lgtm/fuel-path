function createPredictionSecurity({ predictionStorageStatus, tokenAuthorised, tokenSecurity, maxRecords = 500 }) {
  function predictionWriteSecurity() {
    const storage = predictionStorageStatus({ maxRecords });
    return tokenSecurity({
      expected: process.env.PREDICTION_BACKTEST_WRITE_TOKEN,
      storageDurable: storage.durable,
      directHeader: "X-Fuel-Path-Prediction-Token",
    });
  }

  function predictionWriteAuthorised(req = {}) {
    const security = predictionWriteSecurity();
    if (!security.tokenRequired) return true;
    if (!security.tokenConfigured) return false;
    return tokenAuthorised(req, process.env.PREDICTION_BACKTEST_WRITE_TOKEN, "x-fuel-path-prediction-token");
  }

  return { predictionWriteAuthorised, predictionWriteSecurity };
}

module.exports = { createPredictionSecurity };
