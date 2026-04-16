import { createApiClient } from '../src';

const client = createApiClient('https://packrat.test');

client.api.catalog;
client.api.guides;

// Probe the inferred path parameter key shape.
client.api.catalog[':id'];
client.api.guides[':id'];
