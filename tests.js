Pixels.deployed().then(function(instance){return instance.getUserCard.call("0xDc0cdE308bBb933936ECFfd7379aCC11897e0277", 3);}).then(function(value){return value});

// Get contract address
Pixels.new().then(function(res) { sc = Pixels.at(res.address) });
sc.address
// Check if contract
web3.eth.getCode('0x2c2b9c9a4a25e24b174f26114e8926a9f2128fe4')

// Send money to self from first wallet
web3.eth.sendTransaction({from:'0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef', to:'0x52ddEeE3D96dD519ED30DB387443CA4010e96b2D', value: web3.toWei(30, "ether")})

Pixels.deployed().then(function(instance){return instance.withdraw(100000000000000000);}).then(function(value){return value});
