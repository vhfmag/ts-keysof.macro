// @ts-ignore
const { createMacro, MacroError } = require("babel-plugin-macros");
const parser = require("@babel/parser");
const t = require("@babel/types");
const { getTypeBinding } = require("babel-type-scopes");

module.exports = createMacro(typeGuardMacro);

function unimplementedError(path, info) {
  console.log(`Unimplemented: ${path.type}\n${info}`, path);
}

/**
 * @param {import("@babel/types").TSTypeLiteral} typeLiteral
 */
function typeLiteralToKeys(typeLiteral) {
  if (typeLiteral.members.every(x => t.isTSPropertySignature(x))) {
    return JSON.stringify(typeLiteral.members.map(m => m.key.name));
  } else {
    throw unimplementedError(typeLiteral, "typeLiteralToKeys");
  }
}

/**
 *
 *
 * @param {import("@babel/types").TSType} type
 * @param {import("@babel/traverse").NodePath} path
 * @returns {string}
 */
function extractKeys(type, path) {
  if (t.isTSTypeReference(type)) {
    const { typeName } = type;

    if (t.isQualifiedTypeIdentifier(typeName))
      throw unimplementedError(typeName, "is qualified type identifier");

    const binding = getTypeBinding(path, typeName.name);
    const typeDeclaration = binding && binding.path && binding.path.parent;

    if (!typeDeclaration) throw new Error("Identifier not found");

    if (t.isTSTypeLiteral(typeDeclaration.typeAnnotation)) {
      return typeLiteralToKeys(typeDeclaration.typeAnnotation);
    } else {
      throw unimplementedError(
        typeDeclaration,
        "extractKeys - typeReference - typeAnnotation != typeLiteral",
      );
    }
  } else if (t.isTSTypeLiteral(type)) {
    return typeLiteralToKeys(type);
  }

  throw unimplementedError(type, "extractKeys");
}

/**
 *
 * @typedef MacroArgument
 * @type {Object}
 * @prop {import("@babel/core")} babel
 * @prop {{ [key: string]: Array<any> | undefined }} references
 * @prop {{ cwd: string, filename: string, key: string, opts: any, file: import("@babel/types").File }} state
 * @prop {string} source
 */

/**
 *
 *
 * @param {MacroArgument} arg
 */
function typeGuardMacro({ references }) {
  for (const path of references.default) {
    const callExpression = path.parent;

    if (
      !t.isCallExpression(callExpression) ||
      callExpression.typeParameters.params.length !== 1
    ) {
      throw new MacroError(
        "Macro should be called as a function and passed exactly one type parameter",
      );
    }

    const expectedType = callExpression.typeParameters.params[0];
    const generatedCode = extractKeys(expectedType, path);
    const generatedAst = parser.parse(generatedCode);
    path.parentPath.replaceWith(generatedAst.program.body[0]);
  }
}
