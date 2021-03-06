const path = require('path');

module.exports = {
  // devtool: 'inline-source-map',
  mode: 'production',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?/,
        use: 'ts-loader',
        exclude: '/node_modules/'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    filename: 'gif-utils.js',
    path: path.resolve(__dirname, 'dist')
  },
  target: 'node'
};
