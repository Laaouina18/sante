// jest.config.js
module.exports = {
	transform: {
	  '^.+\\.jsx?$': 'babel-jest',
	},
	"coverageDirectory": "coverage",
  "coverageReporters": ["text", "lcov"],
  };
  