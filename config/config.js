var env = process.env.NODE_ENV || 'development';
 
if (env === 'development' || env === 'test') {
  var config = require('./config.json');
  var envConfig = config[env];
  
  Object.keys(envConfig).forEach((key) => {
    process.env[key] = envConfig[key];
  });
}

if (env === 'production') {
  process.env.PORT = 8080
}

console.log(env, process.env.PORT, process.env.MONGODB_URI)