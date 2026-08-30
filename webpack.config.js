const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

// ═══════════════════════════════════════════════════════════════════════
//  SHARED (no optimization — that lives per-config)
// ═══════════════════════════════════════════════════════════════════════
const sharedConfig = {
  mode: isProduction ? 'production' : 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true }
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource'
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  node: { __dirname: false, __filename: false }
};

const nativeModules = [
  'argon2', 'better-sqlite3', 'sodium-native', 'node-gyp-build',
  'exiftool-vendored', 'ffmpeg-static', 'ffprobe-static', 'sharp',
  'onnxruntime-node', 'playwright', 'playwright-extra', 'puppeteer-extra-plugin-stealth'
];

const terserOpts = {
  terserOptions: {
    parse: { ecma: 2020 },
    compress: {
      ecma: 5, comparisons: false, inline: 2,
      drop_console: true, drop_debugger: true,
      pure_funcs: ['console.log', 'console.debug']
    },
    mangle: { safari10: true },
    output: { ecma: 5, comments: false, ascii_only: true }
  },
  parallel: true
};

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PROCESS
// ═══════════════════════════════════════════════════════════════════════
const mainConfig = {
  ...sharedConfig,
  name: 'main',
  target: 'electron-main',
  entry: { main: './src/main/index.ts' },
  output: {
    path: path.resolve(__dirname, 'dist', 'main'),
    filename: 'index.js',
    clean: false  // Don't clean — preload also writes here
  },
  externals: {
    'electron': 'commonjs electron',
    ...Object.fromEntries(nativeModules.map(m => [m, `commonjs ${m}`]))
  },
  devtool: isProduction ? false : 'source-map',
  ...(isProduction && {
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin(terserOpts)],
      usedExports: true
    }
  })
};

// ═══════════════════════════════════════════════════════════════════════
//  PRELOAD SCRIPT
// ═══════════════════════════════════════════════════════════════════════
const preloadConfig = {
  ...sharedConfig,
  name: 'preload',
  target: 'electron-preload',
  entry: { preload: './src/main/preload.ts' },
  output: {
    path: path.resolve(__dirname, 'dist', 'main'),
    filename: 'preload.js',
    clean: false
  },
  externals: { 'electron': 'commonjs electron' },
  devtool: isProduction ? false : 'source-map',
  ...(isProduction && {
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin(terserOpts)],
      usedExports: true
    }
  })
};

// ═══════════════════════════════════════════════════════════════════════
//  RENDERER (UI)
// ═══════════════════════════════════════════════════════════════════════
const rendererConfig = {
  ...sharedConfig,
  name: 'renderer',
  target: 'electron-renderer',
  entry: { renderer: './src/renderer/index.tsx' },
  output: {
    path: path.resolve(__dirname, 'dist', 'renderer'),
    filename: 'index.js',
    clean: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
      minify: isProduction ? {
        removeComments: true, collapseWhitespace: true,
        removeRedundantAttributes: true, useShortDoctype: true,
        removeEmptyAttributes: true, removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true, minifyJS: true, minifyCSS: true, minifyURLs: true
      } : false
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: 'resources', to: 'resources', noErrorOnMissing: true }]
    })
  ],
  devtool: isProduction ? false : 'source-map',
  ...(isProduction && {
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin(terserOpts), new CssMinimizerPlugin()],
      usedExports: true,
      sideEffects: true
    }
  })
};

module.exports = [mainConfig, preloadConfig, rendererConfig];
