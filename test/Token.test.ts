import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Token } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Token Contract", function () {
  // Fixture to deploy the contract
  async function deployTokenFixture() {
    const [owner, addr1, addr2, addr3]: SignerWithAddress[] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("HyperSui");
    const token: Token = await Token.deploy();
    const maxSupply = await token.totalSupply();
    return { token, owner, addr1, addr2, addr3, maxSupply };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.name()).to.equal("HyperSui");
      expect(await token.symbol()).to.equal("HYPESUI");
    });

    it("Should set the correct decimals", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.decimals()).to.equal(18);
    });

    it("Should mint the entire supply to the initial owner", async function () {
      const { token, owner, maxSupply } = await loadFixture(deployTokenFixture);

      const ownerBalance = await token.balanceOf(owner.address);
      expect(ownerBalance).to.equal(maxSupply);
      expect(await token.totalSupply()).to.equal(maxSupply);
    });

    it("Should return correct max supply", async function () {
      const { token, maxSupply } = await loadFixture(deployTokenFixture);

      expect(await token.totalSupply()).to.equal(maxSupply);
      expect(maxSupply).to.equal(ethers.parseEther("7000000000")); // 7 billion
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const transferAmount = ethers.parseEther("100");

      // Transfer from owner to addr1
      await expect(
        token.transfer(addr1.address, transferAmount)
      ).to.changeTokenBalances(
        token,
        [owner, addr1],
        [-transferAmount, transferAmount]
      );

      // Transfer from addr1 to addr2
      await expect(
        token.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
      ).to.changeTokenBalances(
        token,
        [addr1, addr2],
        [-ethers.parseEther("50"), ethers.parseEther("50")]
      );
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      const initialOwnerBalance = await token.balanceOf(owner.address);

      await expect(
        token.connect(addr1).transfer(owner.address, ethers.parseEther("1"))
      ).to.be.reverted;

      expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should emit Transfer event", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      const transferAmount = ethers.parseEther("100");

      await expect(token.transfer(addr1.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });
  });

  describe("Allowances", function () {
    it("Should approve tokens for delegated transfer", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      const approveAmount = ethers.parseEther("100");

      await expect(token.approve(addr1.address, approveAmount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, approveAmount);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approveAmount
      );
    });

    it("Should transfer tokens using transferFrom", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const approveAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("50");

      await token.approve(addr1.address, approveAmount);

      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.changeTokenBalances(
        token,
        [owner, addr2],
        [-transferAmount, transferAmount]
      );

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approveAmount - transferAmount
      );
    });

    it("Should fail transferFrom if allowance is insufficient", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);

      const approveAmount = ethers.parseEther("50");
      const transferAmount = ethers.parseEther("100");

      await token.approve(addr1.address, approveAmount);

      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.be.reverted;
    });
  });

  describe("Burning", function () {
    it("Should allow token holders to burn their tokens", async function () {
      const { token, owner, maxSupply } = await loadFixture(deployTokenFixture);

      const burnAmount = ethers.parseEther("1000");

      await expect(token.burn(burnAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, ethers.ZeroAddress, burnAmount);

      expect(await token.totalSupply()).to.equal(maxSupply - burnAmount);
      expect(await token.balanceOf(owner.address)).to.equal(maxSupply - burnAmount);
    });

    it("Should allow burning tokens from allowance", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      const approveAmount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("50");

      await token.approve(addr1.address, approveAmount);

      await expect(token.connect(addr1).burnFrom(owner.address, burnAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, ethers.ZeroAddress, burnAmount);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approveAmount - burnAmount
      );
    });

    it("Should fail if burning more than balance", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(addr1).burn(ethers.parseEther("1"))
      ).to.be.reverted;
    });
  });

  describe("EIP-2612 Permit", function () {
    it("Should have correct domain separator", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      const domain = await token.DOMAIN_SEPARATOR();
      expect(domain).to.be.properHex(64);
    });

    it("Should return correct nonces", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      expect(await token.nonces(owner.address)).to.equal(0);
    });

    it("Should allow permit approval", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      const value = ethers.parseEther("100");
      const deadline = ethers.MaxUint256;

      const domain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: owner.address,
        spender: addr1.address,
        value: value,
        nonce: await token.nonces(owner.address),
        deadline: deadline,
      };

      const signature = await owner.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(signature);

      await expect(
        token.permit(owner.address, addr1.address, value, deadline, v, r, s)
      )
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, value);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(value);
      expect(await token.nonces(owner.address)).to.equal(1);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount transfers", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await expect(token.transfer(addr1.address, 0)).to.not.be.reverted;
    });

    it("Should handle maximum uint256 approval", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await token.approve(addr1.address, ethers.MaxUint256);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        ethers.MaxUint256
      );
    });

    it("Should prevent transfer to zero address", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      await expect(
        token.transfer(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });
  });
});
