// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract HyperSui is ERC20, ERC20Burnable, ERC20Permit {
    
    /// @notice Maximum supply of tokens (with 18 decimals)
    uint256 private constant MAX_SUPPLY = 7_000_000_000 * 10**18; // 7 billion tokens
    
    constructor() 
        ERC20("HyperSui", "HYPESUI") 
        ERC20Permit("HyperSui")
    {
        _mint("0x3B66F93Fb3Ff1E14c3D7679934C113846ACB3515", MAX_SUPPLY);
    }
}
