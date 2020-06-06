const fastify = require('fastify')();
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

fastify.get('/ping', async (request, reply) => {
  return { hello: 'pong' };
});

const lhPostOpts = {
  schema: {
    body: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      }
    }
  }
};

fastify.post('/lh', lhPostOpts, async (request, reply) => {
  const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});
  const options = {output: 'json', onlyCategories: ['performance'], port: chrome.port};
  const runnerResult = await lighthouse(request.body.url, options);

  // `.lhr` is the Lighthouse Result as a JS object
  console.log('Report is done for', runnerResult.lhr.finalUrl);
  console.log('Performance score was', runnerResult.lhr.categories.performance.score * 100);

  await chrome.kill();
  //return { report: JSON.parse(runnerResult.lhr)};
  return runnerResult.lhr;
});

const start = async () => {
  try {
    const port = process.env.PORT || 8080;
    await fastify.listen(port, '0.0.0.0');
    console.log(`Started at ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
