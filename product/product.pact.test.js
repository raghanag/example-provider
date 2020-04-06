const { Verifier } = require('@pact-foundation/pact');
const controller = require('./product.controller');
const Product = require('./product');

// Setup provider server to verify
const app = require('express')();
const authMiddleware = require('../middleware/auth.middleware');
app.use(authMiddleware);
app.use(require('./product.routes'));
const server = app.listen("8080");

describe("Pact Verification", () => {
  it("validates the expectations of ProductService", () => {
    const baseOpts = {
      logLevel: "INFO",
      providerBaseUrl: "http://localhost:8080",
      providerVersion: process.env.TRAVIS_COMMIT,
      providerVersionTag: process.env.TRAVIS_BRANCH
    }

    // For builds triggered by a 'contract content changed' webhook,
    // just verify the changed pact. The URL will bave been passed in
    // from the webhook to the CI job.
    const pactChangedOpts = {
      pactUrls: [process.env.PACT_URL]
    }

    // For 'normal' provider builds, fetch `master` and `prod` pacts for this provider
    const fetchPactsDynamicallyOpts = {
      provider: "pactflow-example-provider",
      consumerVersionTag: ['master', 'prod'],
      pactBrokerUrl: process.env.PACT_BROKER_BASE_URL,
      enablePending: false
    }

    const opts = {
        ...baseOpts,
        ...(process.env.PACT_URL ? pactChangedOpts : fetchPactsDynamicallyOpts),
        stateHandlers: {
          "product with ID 10 exists": () => {
            controller.repository.products = new Map([
                ["10", new Product("10", "CREDIT_CARD", "28 Degrees", "v1")]
            ]);
          },
          "products exist": () => {
            controller.repository.products = new Map([
              ["09", new Product("09", "CREDIT_CARD", "Gem Visa", "v1")],
              ["10", new Product("10", "CREDIT_CARD", "28 Degrees", "v1")]
            ]);
          },
          "no products exist": () => {
            controller.repository.products = new Map();
          },
          "product with ID 11 does not exist": () => {
            controller.repository.products = new Map();
          },
        },
        requestFilter: (req, res, next) => {
          if (!req.headers["authorization"]) {
            next();
            return;
          }
          req.headers["authorization"] = `Bearer ${new Date().toISOString()}`;
          next();
        },
    };

    return new Verifier(opts).verifyProvider()
      .then(output => {
        console.log("Pact Verification Complete!")
        console.log(output)
      })
      .finally(() => {
        server.close();
    });
  })
});