# tsguard.macro - Typescript type guard macro

[![](https://img.shields.io/travis/com/vhfmag/tsguard.macro.svg)](https://travis-ci.com/vhfmag/tsguard.macro/)

Babel macro that automatically generates an array of keys from a given object type (very much WIP).

[![NPM](https://nodei.co/npm/tsguard.macro.png)](https://npmjs.org/package/tsguard.macro)

## Roadmap

- [x] Implement tests
- [x] Support type references (e.g. `keysof<IProps>`)
- [ ] Support index accessed types
- [ ] Support imported types

## Usage

```ts
import keysof from "ts-keysof.macro";

type Person = { name: string; age: number };

const personKeys = keysof<Person>(); // ["name", "age"]
```
