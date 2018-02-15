var Pixels = artifacts.require("./Pixels.sol");

module.exports = function(deployer) {
  deployer.deploy(Pixels);
  Pixels.new().then(function(res) { console.log("========================");console.log(res.address);console.log("========================"); });
};
