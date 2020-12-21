pragma solidity ^0.6.0;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// import files from common directory
import {
    TokenInterface,
    MemoryInterface,
    EventInterface
} from "./common/interfaces.sol";
import {Stores} from "./common/stores.sol";
import {DSMath} from "./common/math.sol";

interface AccountInterface {
    function isAuth(address _user) external view returns (bool);
}

/**
 * @title ConnectBasic.
 * @dev Connector to deposit/withdraw assets.
 */

contract BasicResolver is Stores {
    event LogDeposit(
        address indexed erc20,
        uint256 tokenAmt,
        uint256 getId,
        uint256 setId
    );
    event LogWithdraw(
        address indexed erc20,
        uint256 tokenAmt,
        address indexed to,
        uint256 getId,
        uint256 setId
    );

    using SafeERC20 for IERC20;

    /**
     * @dev Deposit Assets To Smart Account.
     * @param erc20 Token Address.
     * @param tokenAmt Token Amount.
     * @param getId Get Storage ID.
     * @param setId Set Storage ID.
     */
    function deposit(
        address erc20,
        uint256 tokenAmt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint256 amt = getUint(getId, tokenAmt);
        if (erc20 != getEthAddr()) {
            IERC20 token = IERC20(erc20);
            amt = amt == uint256(-1) ? token.balanceOf(msg.sender) : amt;
            token.safeTransferFrom(msg.sender, address(this), amt);
        } else {
            require(
                msg.value == amt || amt == uint256(-1),
                "invalid-ether-amount"
            );
            amt = msg.value;
        }
        setUint(setId, amt);

        emit LogDeposit(erc20, amt, getId, setId);

        bytes32 _eventCode = keccak256(
            "LogDeposit(address,uint256,uint256,uint256)"
        );
        bytes memory _eventParam = abi.encode(erc20, amt, getId, setId);
        // need to generate insta event contract
        // emitEvent(_eventCode, _eventParam);
    }

    /**
     * @dev Withdraw Assets To Smart Account.
     * @param erc20 Token Address.
     * @param tokenAmt Token Amount.
     * @param to Withdraw token address.
     * @param getId Get Storage ID.
     * @param setId Set Storage ID.
     */
    function withdraw(
        address erc20,
        uint256 tokenAmt,
        address payable to,
        uint256 getId,
        uint256 setId
    ) public payable {
        // require(AccountInterface(address(this)).isAuth(to), "invalid-to-address");
        uint256 amt = getUint(getId, tokenAmt);
        if (erc20 == getEthAddr()) {
            amt = amt == uint256(-1) ? address(this).balance : amt;
            to.transfer(amt);
        } else {
            IERC20 token = IERC20(erc20);
            amt = amt == uint256(-1) ? token.balanceOf(address(this)) : amt;
            token.safeTransfer(to, amt);
        }
        setUint(setId, amt);

        emit LogWithdraw(erc20, amt, to, getId, setId);

        bytes32 _eventCode = keccak256(
            "LogWithdraw(address,uint256,address,uint256,uint256)"
        );
        bytes memory _eventParam = abi.encode(erc20, amt, to, getId, setId);
        // need to generate insta event contract
        //emitEvent(_eventCode, _eventParam);
    }
}

contract ConnectBasic is BasicResolver {
    string public constant name = "Basic-v1.1";

    function connectorID()
        public
        override
        view
        returns (uint256 model, uint256 id)
    {
        (model, id) = (0, 1);
    }
}
