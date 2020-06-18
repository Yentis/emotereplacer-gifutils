const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'gif-utils.js',
        path: path.resolve(__dirname, 'dist')
    },
    target: 'node'
};