module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    rinkeby: {
      host: "localhost", // Connect to geth on the specified
      port: 8545,
      from: "0xd59a1edB9B13995607FF15bbb5f7AE28bd33ebbE",
      network_id: 4,
      gas: 4612388 // Gas limit used for deploys
    }
  }
};
