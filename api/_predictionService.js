const { createPredictionCollectionService } = require("./_predictionCollectionService");

function createPredictionService(dependencies) {
  return createPredictionCollectionService(dependencies);
}

module.exports = { createPredictionService };
