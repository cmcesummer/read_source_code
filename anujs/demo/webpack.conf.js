const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

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
                use: [
                    { loader: "babel-loader" },
                    {
                        loader: path.join(__dirname, "./loader.js"),
                        options: {
                            env: process.env.NODE_ENV
                        }
                    }
                ]
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
