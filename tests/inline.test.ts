// @ts-ignore
import tsguard from "../src/macro";

describe("type aliases", () => {
  it("should work for basic object", () => {
    type SomeAlias = { name: string; age: number };
    expect(tsguard<SomeAlias>()).toEqual(["name", "age"]);
  });

  it("should work for object with optional properties", () => {
    type SomeAlias = { name: string; age?: number };
    expect(tsguard<SomeAlias>()).toEqual(["name", "age"]);
  });

  it("should work for object with readonly properties", () => {
    type SomeAlias = { name: string; readonly age: number };
    expect(tsguard<SomeAlias>()).toEqual(["name", "age"]);
  });

  it("should find type from closest scope", () => {
    type SomeAlias = { nome: string; idade: number };

    {
      type SomeAlias = { name: string; age: number };
      expect(tsguard<SomeAlias>()).toEqual(["name", "age"]);
    }
  });

  it("should not find out-of-scope types", () => {
    type SomeAlias = { name: string; age: number };

    {
      {
        type SomeAlias = { nome: string; idade: number };
      }

      expect(tsguard<SomeAlias>()).toEqual(["name", "age"]);
    }
  });
});

describe("inline type", () => {
  it("should work for basic object", () => {
    expect(tsguard<{ name: string; age: number }>()).toEqual(["name", "age"]);
  });
});
