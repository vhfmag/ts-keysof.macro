// @ts-ignore
const { createMacro, MacroError } = require("babel-plugin-macros");
const parser = require("@babel/parser");
const t = require("@babel/types");
const { addNamespace } = require("@babel/helper-module-imports");
const { getClosestTypeScope, getTypeBinding } = require("babel-type-scopes");
const path = require("path");

module.exports = createMacro(typeGuardMacro);

function unimplementedError(path) {
  console.log(`Unimplemented: ${path.type} (${JSON.stringify(path)})`);
}

// lacking: TSTupleType | TSOptionalType | TSRestType | TSConditionalType | TSInferType | TSTypeOperator | TSIndexedAccessType | TSMappedType | TSExpressionWithTypeArguments
// not sure on how to handle those: TSVoidKeyword | TSThisType | TSConstructorType | TSTypeReference | TSTypePredicate | TSTypeQuery |

function readAndTransform(fileName, baseName, babel) {
  let transformed = null;

  for (const extension of ["", ".ts", ".tsx", ".d.ts", ".js", ".jsx"]) {
    const generatedFileName = path.join(
      path.dirname(baseName),
      fileName + extension,
    );
    console.log(generatedFileName);
    try {
      transformed = babel.transformFileSync(generatedFileName, {
        plugins: ["@babel/plugin-syntax-typescript"],
      });
    } catch (error) {
      console.error(error);
    }
  }

  return transformed;
}

/**
 *
 *
 * @param {import("@babel/types").TSType} type
 * @param {string} tg
 * @param {import("@babel/traverse").NodePath} path
 * @param {string} fileName
 * @param {import("@babel/core")} babel
 * @returns {string}
 */
function typeToPartialGuard(type, tg, path, fileName, babel) {
  if (t.isTSNeverKeyword(type)) {
    return "(() => false)";
  } else if (t.isTSAnyKeyword(type) || t.isTSUnknownKeyword(type)) {
    return "(() => true)";
  } else if (t.isTSUndefinedKeyword(type)) {
    return `${tg}.isUndefined`;
  } else if (t.isTSNullKeyword(type)) {
    return `${tg}.isNull`;
  } else if (t.isTSFunctionType(type)) {
    return `(v => v instanceof Function)`;
  } else if (t.isTSSymbolKeyword(type)) {
    return `(v => type v === "symbol")`;
  } else if (t.isTSBooleanKeyword(type)) {
    return `${tg}.isBoolean`;
  } else if (t.isTSNumberKeyword(type)) {
    return `${tg}.isNumber`;
  } else if (t.isTSNumberKeyword(type)) {
    return `${tg}.isNumber`;
  } else if (t.isTSObjectKeyword(type)) {
    return `${tg}.isObject`;
  } else if (t.isTSStringKeyword(type)) {
    return `${tg}.isString`;
  } else if (t.isTSLiteralType(type)) {
    return `(v => v === ${JSON.stringify(type.literal.value)})`;
  } else if (t.isTSParenthesizedType(type)) {
    return typeToPartialGuard(type.typeAnnotation, tg, path, fileName, babel);
  } else if (t.isTSArrayType(type)) {
    return `${tg}.isArray(${typeToPartialGuard(
      type.elementType,
      tg,
      path,
      fileName,
      babel,
    )})`;
  } else if (t.isTSTypeLiteral(type)) {
    const propertyGuards = type.members.map(propType => {
      if (t.isTSPropertySignature(propType)) {
        if (t.isIdentifier(propType.key)) {
          const partialTypeGuard = typeToPartialGuard(
            propType.typeAnnotation.typeAnnotation,
            tg,
            path,
            fileName,
            babel,
          );

          return `.withProperty("${propType.key.name}", ${
            propType.optional
              ? `${tg}.isOptional(${partialTypeGuard})`
              : partialTypeGuard
          })`;
        } else if (t.isBinaryExpression(propType.key)) {
          // { [key in T] }
          throw unimplementedError(type);
        }

        throw unimplementedError(type);
      } else if (t.isTSIndexSignature(propType)) {
        // { [key: string] }
        throw unimplementedError(type);
      }

      // ???
      throw unimplementedError(type);
    });
    return `(new ${tg}.IsInterface()${propertyGuards.join("")}.get())`;
  } else if (t.isTSIntersectionType(type)) {
    return `${tg}.isIntersection(${type.types
      .map(nestedType =>
        typeToPartialGuard(nestedType, tg, path, fileName, babel),
      )
      .join(", ")})`;
  } else if (t.isTSUnionType(type)) {
    return `${tg}.isUnion(${type.types
      .map(nestedType =>
        typeToPartialGuard(nestedType, tg, path, fileName, babel),
      )
      .join(", ")})`;
  } else if (t.isTSTypeReference(type)) {
    if (t.isIdentifier(type.typeName)) {
      /**
       * @type {{ kind: "declaration" | "import", path: import("@babel/traverse").NodePath<import("@babel/types").Identifier> }}
       */
      const binding = getTypeBinding(
        getClosestTypeScope(path),
        type.typeName.name,
      );

      if (binding.kind === "import") {
        const sourcePath = binding.path.parentPath.parent.source.value;
        console.error({ sourcePath });
        let transformed = readAndTransform(sourcePath, fileName, babel);
        // import { SomeType } from "source";
        throw unimplementedError(type);
      } else if (binding.kind === "declaration") {
        return typeToPartialGuard(
          binding.path.container.typeAnnotation,
          tg,
          path,
          fileName,
          babel,
        );
      } else {
        // ???
        throw unimplementedError(type);
      }
    } else if (t.isTSQualifiedName(type.typeName)) {
      // A.B.C
      const binding = getTypeBinding(
        getClosestTypeScope(path),
        type.typeName.right.name,
      );
      console.log({ binding });
      throw unimplementedError(type);
    }
  }

  throw unimplementedError(type);
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
function typeGuardMacro({ references, state, babel, source }) {
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

    const macroArgument = callExpression.arguments[0];

    if (!t.isIdentifier(macroArgument)) {
      throw new MacroError(
        "For now, this macro works with identifiers only, sorry",
      );
    }

    const generatedImport = addNamespace(path, "generic-type-guard");

    if (!t.isIdentifier(generatedImport)) {
      throw new MacroError("Something wrong happened at our side, sorry");
    }

    const expectedType = callExpression.typeParameters.params[0];
    const identifier = macroArgument.name;
    const generatedCode = `(${typeToPartialGuard(
      expectedType,
      generatedImport.name,
      path,
      state.filename,
      babel,
    )})(${identifier})`;
    const generatedAst = parser.parse(generatedCode);
    path.parentPath.replaceWith(generatedAst.program.body[0]);
  }
}
