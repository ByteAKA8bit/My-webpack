const fs = require('fs');
const path = require('path');

const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

const root = process.cwd();

module.exports = {
  initLoader(filename, config) {
    let source = fs.readFileSync(filename, 'utf-8');
    const rules = config.module && config.module.rules;
    rules &&
      rules.forEach((rule) => {
        const { test, use } = rule;
        let l = use.length - 1;
        if (test.test(filename)) {
          function execLoader() {
            const loader = require(use[l--]);
            source = loader(source);
            if (l >= 0) {
              execLoader();
            }
          }
          execLoader();
        }
      });
    return source;
  },

  parse(filename, config) {
    const ast = this.genAST(filename, config);
    const dependencies = [];
    const dirname = path.dirname(filename);
    traverse(ast, {
      CallExpression({ node }) {
        if (node.callee.name === 'require') {
          let moduleFile = path.resolve(dirname, node.arguments[0].value);
          moduleFile = path.relative(root, moduleFile);
          moduleFile = './' + moduleFile.replace(/\\/g, '/');
          node.arguments[0].value = moduleFile;
          dependencies.push(moduleFile);
        }
      },
      ImportDeclaration({ node }) {
        let moduleFile = path.resolve(dirname, node.source.value);
        moduleFile = path.relative(root, moduleFile);
        moduleFile = './' + moduleFile.replace(/\\/g, '/');
        node.source.value = moduleFile;
        dependencies.push(moduleFile);
      },
    });
    const { code } = babel.transformFromAst(ast, null, {
      presets: ['@babel/preset-env'],
    });
    return {
      code,
      dependencies,
    };
  },
  genAST(filename, config) {
    const sourceCode = this.initLoader(filename, config);
    const ast = babelParser.parse(sourceCode, {
      sourceType: 'module',
    });
    return ast.program;
  },
};
