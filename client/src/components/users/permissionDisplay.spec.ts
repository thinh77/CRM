import test from "node:test";
import assert from "node:assert/strict";
import {
  getNextPermissionState,
  getPermissionDisplay,
  type PermState,
} from "./permissionDisplay.ts";

test("marks inherited effective permissions as green while keeping inherited label", () => {
  const display = getPermissionDisplay("inherit", "customers:read", ["customers:read"]);

  assert.equal(display.text, "Kế thừa");
  assert.equal(display.isEffective, true);
  assert.match(display.cls, /bg-green-100/);
});

test("lets inherited permissions toggle directly between inherit and revoke", () => {
  assert.equal(getNextPermissionState("inherit", true), "revoke");
  assert.equal(getNextPermissionState("revoke", true), "inherit");
});

test("lets non-inherited permissions toggle between inherit and grant", () => {
  assert.equal(getNextPermissionState("inherit", false), "grant");
  assert.equal(getNextPermissionState("grant", false), "inherit");
});

test("keeps explicit overrides visually authoritative over inherited permissions", () => {
  const grantDisplay = getPermissionDisplay("grant", "customers:create", []);
  const revokeDisplay = getPermissionDisplay("revoke", "customers:read", ["customers:read"]);

  assert.equal(grantDisplay.text, "Cấp thêm");
  assert.equal(grantDisplay.isEffective, true);
  assert.match(grantDisplay.cls, /bg-green-100/);

  assert.equal(revokeDisplay.text, "Tước bỏ");
  assert.equal(revokeDisplay.isEffective, false);
  assert.match(revokeDisplay.cls, /bg-red-100/);
});

test("treats wildcard permission as effective for inherited display", () => {
  const display = getPermissionDisplay("inherit", "organization:read", ["*"]);

  assert.equal(display.text, "Kế thừa");
  assert.equal(display.isEffective, true);
  assert.match(display.cls, /bg-green-100/);
});

const _typeCheck: PermState = "inherit";
assert.equal(_typeCheck, "inherit");
