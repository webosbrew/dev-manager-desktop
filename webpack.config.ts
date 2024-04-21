//Polyfill Node.js core modules in Webpack. This module is only needed for webpack 5+.
import {BuildOptions} from "@angular-devkit/build-angular/src/utils/build-options";
import {Configuration, ProvidePlugin} from 'webpack';


/**
 * Custom angular webpack configuration
 */
module.exports = (config: Configuration, options: BuildOptions) => {
    config.target = 'web';

    if (options.fileReplacements) {
        for (let fileReplacement of options.fileReplacements) {
            if (fileReplacement.replace !== 'src/environments/environment.ts') {
                continue;
            }

            let fileReplacementParts = fileReplacement['with'].split('.');
            if (fileReplacementParts.length > 1 && ['web'].indexOf(fileReplacementParts[1]) >= 0) {
                config.target = 'web';
            }
            break;
        }
    }

    config.plugins = [
        ...config.plugins ?? [],
        new ProvidePlugin({
            process: 'process/browser',
        })
    ];
    config.resolve!!.fallback = {
        path: require.resolve("path-browserify"),
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        vm: require.resolve("vm-browserify"),
    };

    if (!config.module) {
        config.module = {};
    }
    if (!config.module.rules) {
        config.module.rules = [];
    }

    config.module.rules.push({test: /\.sh/, type: 'asset/source'});

    return config;
};
