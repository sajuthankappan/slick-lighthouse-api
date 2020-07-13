const fastify = require('fastify')();
const lighthouse = require('lighthouse');
const lighthouseConstants = require('../node_modules/lighthouse/lighthouse-core/config/constants');
const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');

fastify.get('/', async (request, reply) => {
  return { hello: 'lighthouse 5' };
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
        device: { type: 'string' },
        throttling: { type: 'string' },
        attempts: { type: 'number' },
        blockedUrlPatterns: {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        cookie: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' }
          }
        }
      }
    }
  }
};

fastify.post('/report', lhPostOpts, async (request, reply) => {
  try {
    const config = getLighthouseConfig(request);
    const attempts = getAttempts(request);
    const blockedUrlPatterns = getBlockedUrlPatterns(request);
    
    let results = [];
    let bestScore = 0;
    let bestScoreIndex = 0;
    
    for (let attempt = 0; attempt < attempts; attempt++) {
      const chrome = await chromeLauncher.launch({chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']});
      console.log('Launched chrome in port ', chrome.port);

      if (request.body.cookie && request.body.cookie.name && request.body.cookie.value) {
        const client = await CDP({ port: chrome.port });
        var { Network } = client;
  
        await Network.enable();
        await Network.setCookie({ name: request.body.cookie.name, value: request.body.cookie.value, url: request.body.url });
        console.log('Cookie set');
      }

      const options = {output: 'json', blockedUrlPatterns, onlyCategories: ['performance'], port: chrome.port};
      const runnerResult = await lighthouse(request.body.url, options, config);
      // `.lhr` is the Lighthouse Result as a JS object
      console.log('Report attempt ', attempt, ' is done for', runnerResult.lhr.finalUrl);
      console.log('Performance score for ', request.body.url, ' was ', runnerResult.lhr.categories.performance.score * 100);
      results.push(runnerResult.lhr);
      if (runnerResult.lhr.categories.performance.score > bestScore) {
        bestScore = runnerResult.lhr.categories.performance.score;
        bestScoreIndex = attempt;
      }
      await chrome.kill();
    }

    if (attempts === 1) {
      return results[0];
    } else {
      return { 
        bestScore,
        bestScoreIndex,
        results,
      };
    }
  } catch (e) {
    if (e.message && e.message.startsWith('Unknown')) {
      reply
        .code(400)
        .send(e.message);
    } else {
      console.error(e);
      reply
        .code(500)
        .send('Internal server error');
    }
  }
});

const getLighthouseConfig = (request) => {
  const throttling = getThrottling(request);
  if (request.body.device === 'desktop') {
    // Taken from https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/config/lr-desktop-config.js
    return {
      extends: 'lighthouse:default',
      settings: {
        emulatedFormFactor: 'desktop',
        throttling,
        // TODO
        // Skip the h2 audit so it doesn't lie to us. See https://github.com/GoogleChrome/lighthouse/issues/6539
        // skipAudits: ['uses-http2'],
      },
    };
  } else if (!request.body.device || request.body.device === 'mobile'){
    return {
      extends: 'lighthouse:default',
      settings: {
        emulatedFormFactor: 'mobile',
        throttling,
      },
    };
  } else {
    throw new Error(`Unknown device ${request.body.device}`);
  }
};

const getThrottling = (request) => {
  if (request.body.throttling) {
    switch (request.body.throttling) {
    case 'desktopDense4G':
      return lighthouseConstants.throttling.desktopDense4G;
    case 'mobileSlow4G':
      return lighthouseConstants.throttling.mobileSlow4G;
    case 'mobileRegluar3G':
      return lighthouseConstants.throttling.mobileRegluar3G;
    default:
      throw new Error(`Unknown throttling ${request.body.throttling}`);
    }
  } else {
    if (request.body.device === 'desktop') {
      return lighthouseConstants.throttling.desktopDense4G;
    } else if (!request.body.device || request.body.device === 'mobile') {
      return lighthouseConstants.throttling.mobileSlow4G;
    } else {
      throw new Error(`Unknown device ${request.body.device}`);
    }
  }
};

const getAttempts = (request) => {
  if (request.body.attempts) {
    return parseInt(request.body.attempts);
  } else {
    return 3;
  }
};

const getBlockedUrlPatterns = (request) => {
  if (request.body.blockedUrlPatterns) {
    return request.body.blockedUrlPatterns;
  } else {
    return null;
  }
};

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
