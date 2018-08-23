const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    mode: "development",
    entry: "./src/index.js",
    output: {
        path: __dirname + "/dist/",
        filename: "[name].js"
    },
    devtool: "cheap-module-eval-source-map",
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: "babel-loader"
            }
        ]
    },
    resolve: {
        alias: {
            react: "anujs",
            "react-dom": "anujs",
            "prop-types": "anujs/lib/ReactPropTypes",
            "create-react-class": "anujs/lib/createClass"
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: "indexa.html",
            template: "./index.html",
            inject: true
        })
    ]
};
