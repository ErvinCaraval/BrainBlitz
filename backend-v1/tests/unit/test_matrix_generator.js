const fs = require('fs');

function cartesianProduct(arrays) {
  return arrays.reduce((a, b) => a.flatMap(d => b.map(e => [ ...d, e ])), [[]]);
}

function generateMatrix(params) {
  const keys = Object.keys(params);
  const values = Object.values(params);
  const combos = cartesianProduct(values);
  return combos.map(combo => Object.fromEntries(combo.map((v, i) => [keys[i], v])));
}

if (require.main === module) {
  const params = JSON.parse(process.argv[2] || '{}');
  const matrix = generateMatrix(params);
  fs.writeFileSync('tests/reports/test_matrix.json', JSON.stringify(matrix, null, 2));
  console.log(matrix);
}

module.exports = { generateMatrix };
