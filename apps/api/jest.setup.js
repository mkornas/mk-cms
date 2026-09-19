// Decorator metadata (TypeORM/Nest) needs reflect-metadata loaded before any
// decorated class is imported.
require('reflect-metadata');

// Keep test output clean — silence Nest's logger (registry/manager debug lines).
const { Logger } = require('@nestjs/common');
Logger.overrideLogger(false);
