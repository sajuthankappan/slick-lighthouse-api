const fastify = require('fastify')();
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

fastify.get('/', async (request, reply) => {
  return { hello: 'lighthouse 6' };
});

fastify.get('/ping', async (request, reply) => {
  return { data: 'pong' };
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

fastify.post('/report', lhPostOpts, async (request, reply) => {
  try {
    const chrome = await chromeLauncher.launch({chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']});
    console.log('Launched chrome in port ', chrome.port);
    const options = {output: 'json', onlyCategories: ['performance'], port: chrome.port};
    
    const totalAttempts = 3;
    let results = [];
    let bestScore = 0;
    let bestScoreIndex = 0;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      const runnerResult = await lighthouse(request.body.url, options);
      // `.lhr` is the Lighthouse Result as a JS object
      console.log('Report attempt ', attempt, ' is done for', runnerResult.lhr.finalUrl);
      console.log('Performance score for ', request.body.url, ' was ', runnerResult.lhr.categories.performance.score * 100);
      results.push(runnerResult.lhr);
      if (runnerResult.lhr.categories.performance.score > bestScore) {
        bestScore = runnerResult.lhr.categories.performance.score;
        bestScoreIndex = attempt;
      }
    }

    await chrome.kill();
    return { 
      bestScore,
      bestScoreIndex,
      results,
    };
  } catch (e) {
    console.error(e);
    reply
      .code(500)
      .send('Internal server error');
  }
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
