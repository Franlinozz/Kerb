// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IKerbTerms} from "../interfaces/IKerb.sol";
import {KerbMarkFeed} from "./KerbMarkFeed.sol";

/// @title KerbMarkFeedFactory
/// @notice Creates one KerbMarkFeed per asset at a deterministic address (CREATE2, salt = assetId).
///         Anyone may create a feed; a second feed for the same asset reverts. No owner.
contract KerbMarkFeedFactory {
    event FeedCreated(bytes32 indexed assetId, address feed, string description);

    error FeedExists(bytes32 assetId, address feed);

    IKerbTerms public immutable terms;
    mapping(bytes32 => address) public feedOf;

    constructor(IKerbTerms terms_) {
        terms = terms_;
    }

    function create(bytes32 assetId, string calldata description) external returns (address feed) {
        if (feedOf[assetId] != address(0)) revert FeedExists(assetId, feedOf[assetId]);
        feed = address(new KerbMarkFeed{salt: assetId}(terms, assetId, description));
        feedOf[assetId] = feed;
        emit FeedCreated(assetId, feed, description);
    }
}
