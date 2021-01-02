pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    AaveHelpers,
    AaveInterface,
    AaveDataProviderInterface
} from "./ConnectAaveV2.sol";

// import files from common directory
import {
    TokenInterface,
    MemoryInterface,
    EventInterface
} from "./common/interfaces.sol";
import {Stores} from "./common/stores.sol";
import {DSMath} from "./common/math.sol";

/**
 * @title DCAAccount.
 * @dev DeFi Smart Account Wallet.
 */

interface IndexInterface {
    function connectors(uint256 version) external view returns (address);

    function check(uint256 version) external view returns (address);

    function list() external view returns (address);
}

interface ConnectorsInterface {
    function isConnector(address[] calldata logicAddr)
        external
        view
        returns (bool);

    function isStaticConnector(address[] calldata logicAddr)
        external
        view
        returns (bool);
}

interface CheckInterface {
    function isOk() external view returns (bool);
}

interface ListInterface {
    function addAuth(address user) external;

    function removeAuth(address user) external;
}

contract Record {
    address owner;

    event LogEnable(address indexed user);
    event LogDisable(address indexed user);
    event LogSwitchShield(bool _shield);

    // InstaIndex Address.
    address public instaIndex = 0x0000000000000000000000000000000000000000;
    // The Account Module Version.
    uint256 public constant version = 1;
    // Auth Module(Address of Auth => bool).
    mapping(address => bool) private auth;
    // Is shield true/false.
    bool public shield;

    uint256 public depositAmount;
    // liquidity pool token
    address public token;
    // timestamp value that must pass before executing another dca operation
    uint256 public period;
    // timestamp of next dca operation
    uint256 public timeRef;

    constructor() public {
        owner = msg.sender;
    }

    /**
     * @dev Check for Auth if enabled.
     * @param user address/user/owner.
     */
    function isAuth(address user) public view returns (bool) {
        return auth[user];
    }

    /**
     * @dev Change Shield State.
     */
    function switchShield(bool _shield) external {
        require(auth[msg.sender], "not-self");
        require(shield != _shield, "shield is set");
        shield = _shield;
        emit LogSwitchShield(shield);
    }

    function char(bytes1 b) internal view returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }

    function toAsciiString(address x)
        internal
        view
        returns (string memory addr)
    {
        bytes memory s = new bytes(40);
        for (uint256 i = 0; i < 20; i++) {
            uint256 addr = uint256(x);
            bytes1 b = bytes1(uint8(addr / (2**(8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 * i] = char(hi);
            s[2 * i + 1] = char(lo);
        }
        return string(s);
    }

    /**
     * @dev Enable New User.
     * @param user Owner of the Smart Account.
     */
    function enable(address user) public {
        require(
            msg.sender == address(this) || msg.sender == instaIndex,
            string(
                abi.encodePacked(
                    "not-self-index ",
                    toAsciiString(msg.sender),
                    " ",
                    toAsciiString(instaIndex)
                )
            )
        );
        require(user != address(0), "not-valid");
        require(!auth[user], "already-enabled");
        auth[user] = true;
        ListInterface(IndexInterface(instaIndex).list()).addAuth(user);
        emit LogEnable(user);
    }

    /**
     * @dev Disable User.
     * @param user Owner of the Smart Account.
     */
    function disable(address user) public {
        require(msg.sender == address(this), "not-self");
        require(user != address(0), "not-valid");
        require(auth[user], "already-disabled");
        delete auth[user];
        ListInterface(IndexInterface(instaIndex).list()).removeAuth(user);
        emit LogDisable(user);
    }
}

contract DepositerWithdrawer is Stores {
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

        bytes32 _eventCode =
            keccak256("LogDeposit(address,uint256,uint256,uint256)");
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
        // require(msg.sender == owner, "permission-denied");
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

        bytes32 _eventCode =
            keccak256("LogWithdraw(address,uint256,address,uint256,uint256)");
        bytes memory _eventParam = abi.encode(erc20, amt, to, getId, setId);
        // need to generate insta event contract
        //emitEvent(_eventCode, _eventParam);
    }
}

contract LiquidityPoolDepositerWithdrawer is AaveHelpers {
    event LogLiquidityPoolDeposit(
        address indexed token,
        uint256 tokenAmt,
        uint256 getId,
        uint256 setId
    );
    event LogLiquidityPoolWithdraw(
        address indexed token,
        uint256 tokenAmt,
        uint256 getId,
        uint256 setId
    );

    /**
     * @dev Deposit ETH/ERC20_Token.
     * @param token token address to deposit.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amt token amount to deposit.
     * @param getId Get token amount at this ID from `InstaMemory` Contract.
     * @param setId Set token amount at this ID in `InstaMemory` Contract.
     */
    function depositLiquidityPool(
        address token,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint256 _amt = getUint(getId, amt);

        AaveInterface aave = AaveInterface(getAaveProvider().getLendingPool());
        AaveDataProviderInterface aaveData = getAaveDataProvider();

        bool isEth = token == getEthAddr();
        address _token = isEth ? getWethAddr() : token;

        TokenInterface tokenContract = TokenInterface(_token);

        if (isEth) {
            _amt = _amt == uint256(-1) ? address(this).balance : _amt;
            convertEthToWeth(isEth, tokenContract, _amt);
        } else {
            _amt = _amt == uint256(-1)
                ? tokenContract.balanceOf(address(this))
                : _amt;
        }

        tokenContract.approve(address(aave), _amt);

        aave.deposit(_token, _amt, address(this), getReferralCode());

        if (!getIsColl(aaveData, _token, address(this))) {
            aave.setUserUseReserveAsCollateral(_token, true);
        }

        setUint(setId, _amt);

        emit LogLiquidityPoolDeposit(token, _amt, getId, setId);
    }

    /**
     * @dev Withdraw ETH/ERC20_Token.
     * @param token token address to withdraw.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amt token amount to withdraw.
     * @param getId Get token amount at this ID from `InstaMemory` Contract.
     * @param setId Set token amount at this ID in `InstaMemory` Contract.
     */
    function withdrawLiquidityPool(
        address token,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint256 _amt = getUint(getId, amt);

        AaveInterface aave = AaveInterface(getAaveProvider().getLendingPool());
        bool isEth = token == getEthAddr();
        address _token = isEth ? getWethAddr() : token;

        TokenInterface tokenContract = TokenInterface(_token);

        uint256 initialBal = tokenContract.balanceOf(address(this));
        aave.withdraw(_token, _amt, address(this));
        uint256 finalBal = tokenContract.balanceOf(address(this));

        _amt = sub(finalBal, initialBal);

        convertWethToEth(isEth, tokenContract, _amt);

        setUint(setId, _amt);

        emit LogLiquidityPoolWithdraw(token, _amt, getId, setId);
    }
}

contract DCAAccount is
    Record,
    DepositerWithdrawer,
    LiquidityPoolDepositerWithdrawer
{
    event LogCast(
        address indexed origin,
        address indexed sender,
        uint256 value
    );

    receive() external payable {}

    function initialize(
        address _token,
        uint256 _depositAmount,
        uint256 _period
    ) external {
        require(msg.sender == instaIndex, "permission-denied");

        token = _token;
        depositAmount = _depositAmount;
        period = _period;
        timeRef = block.timestamp + _period;
    }

    function dca(address _origin) external payable {
        require(
            isAuth(msg.sender) || msg.sender == instaIndex,
            "permission-denied"
        );
        require(timeRef < block.timestamp, "not permited yet");

        depositLiquidityPool(token, depositAmount, 0, 0);

        timeRef = block.timestamp + period;

        emit LogCast(_origin, msg.sender, msg.value);
    }

    function setIndex(address _instaIndex) external {
        instaIndex = _instaIndex;
    }
}
