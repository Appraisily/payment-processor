const StorageRepository = require('./storage.repository');
const CustomerRepository = require('./customer.repository');

function createRepositories(config) {
  return {
    storage: new StorageRepository(config),
    customer: new CustomerRepository(config)
  };
}

module.exports = createRepositories;