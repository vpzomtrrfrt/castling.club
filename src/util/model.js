const q = require("./q");

exports.transact = q.transact;

exports.tryInsertInboxObject = (pg, activityId, createdAt) =>
  q(pg)`
    -- try insert inbox object
    insert into inbox (activity_id, created_at)
    values (${activityId}, ${createdAt})
    on conflict (activity_id) do nothing
  `;

exports.insertOutboxObject = (pg, id, object, activity, createdAt) =>
  q(pg)`
    -- insert outbox object
    insert into outbox (id, object, activity, has_fen, created_at)
    values (${id}, ${object}, ${activity}, ${!!object.fen}, ${createdAt})
  `;

exports.insertDelivery = (pg, id, addressee, createdAt) =>
  q(pg)`
    -- insert delivery
    insert into deliveries (outbox_id, addressee, attempt_at)
    values (${id}, ${addressee}, ${createdAt})
  `;

exports.getOutboxObjectById = (pg, id) =>
  q(pg)`
    -- get outbox object by id
    select object, has_fen, created_at
    from outbox
    where id = ${id}
  `;

exports.getPrevOutboxMoveId = (pg, gameId, refCreatedAt) =>
  q(pg)`
    -- get prev outbox id
    select id
    from outbox
    where
      id in (
        select object_id
        from game_objects
        where game_id = ${gameId}
      ) and
      has_fen = true and
      created_at < ${refCreatedAt}
    order by created_at desc
    limit 1
  `;

exports.getNextOutboxMoveId = (pg, gameId, refCreatedAt) =>
  q(pg)`
    -- get next outbox id
    select id
    from outbox
    where
      id in (
        select object_id
        from game_objects
        where game_id = ${gameId}
      ) and
      has_fen = true and
      created_at > ${refCreatedAt}
    order by created_at asc
    limit 1
  `;

exports.getGameOverById = (pg, id) =>
  q(pg)`
    -- get game over by id
    select game_over
    from games
    where id = ${id}
  `;

exports.getOutboxActivityById = (pg, id) =>
  q(pg)`
    -- get outbox activity by id
    select activity, has_fen
    from outbox
    where id = ${id}
  `;

exports.lockSharedAddresseeDeliveries = (pg, addressee) =>
  q(pg)`
    -- lock shared addressee deliveries
    select outbox_id from deliveries
    where
      addressee = ${addressee} and
      inbox is null
    for update skip locked
  `;

exports.updateDeliveryInboxByAddressee = (
  pg,
  outboxIds,
  addressee,
  inbox,
  attemptAt
) =>
  q(pg)`
    -- update delivery inbox by addressee
    update deliveries set
      inbox = ${inbox},
      attempt_at = ${attemptAt},
      attempt_num = 0
    where
      outbox_id = any (${outboxIds}) and
      addressee = ${addressee}
  `;

exports.lockSharedInboxDeliveries = (pg, outboxId, inbox) =>
  q(pg)`
    -- lock shared inbox deliveries
    select addressee from deliveries
    where
      outbox_id = ${outboxId} and
      inbox = ${inbox}
    for update skip locked
  `;

exports.getOutboxById = (pg, id) =>
  q(pg)`
    -- get outbox by id
    select object, activity
    from outbox
    where id = ${id}
  `;

exports.updateDeliveryAttemptByAddressees = (
  pg,
  outboxId,
  addressees,
  attemptAt,
  attemptNum
) =>
  q(pg)`
    -- update delivery attempt by addressees
    update deliveries set
      attempt_at = ${attemptAt},
      attempt_num = ${attemptNum}
    where
      outbox_id = ${outboxId} and
      addressee = any (${addressees})
  `;

exports.deleteDeliveriesByAddressees = (pg, outboxId, addressees) =>
  q(pg)`
    -- delete deliveries by addressees
    delete from deliveries
    where
      outbox_id = ${outboxId} and
      addressee = any (${addressees})
  `;

exports.getNextDelivery = pg =>
  q(pg)`
    -- get next delivery
    select outbox_id, addressee, inbox, attempt_at, attempt_num
    from deliveries
    order by attempt_at asc
    limit 1
    for update skip locked
  `;

exports.getGameByObjectForUpdate = (pg, objectId) =>
  q(pg)`
    -- get game by object id for update
    select id, white_id, white_name, black_id, black_name, fen, badge
    from games
    where id = (
      select game_id
      from game_objects
      where object_id = ${objectId}
    )
    for update
  `;

exports.updateGame = (pg, id, fen, gameOver, updatedAt) =>
  q(pg)`
    -- update game
    update games
    set
      fen = ${fen},
      game_over = ${gameOver},
      num_moves = num_moves + 1,
      updated_at = ${updatedAt}
    where
      id = ${id}
  `;

exports.insertGame = (
  pg,
  id,
  whiteId,
  whiteName,
  blackId,
  blackName,
  fen,
  badge,
  createdAt
) =>
  q(pg)`
    -- insert game
    insert into games (
      id,
      white_id,
      white_name,
      black_id,
      black_name,
      fen,
      badge,
      created_at,
      updated_at
    ) values (
      ${id},
      ${whiteId},
      ${whiteName},
      ${blackId},
      ${blackName},
      ${fen},
      ${badge},
      ${createdAt},
      ${createdAt}
    )
  `;

exports.insertGameObject = (pg, gameId, objectId) =>
  q(pg)`
    -- insert game object
    insert into game_objects (object_id, game_id)
    values (${objectId}, ${gameId})
  `;

exports.getGameById = (pg, id) =>
  q(pg)`
    -- get game by id
    select
      id,
      white_id,
      white_name,
      black_id,
      black_name,
      fen,
      badge,
      game_over
    from
      games
    where
      id = ${id}
  `;

exports.getOutboxMovesByGame = (pg, gameId) =>
  q(pg)`
    -- get outbox objects by game
    select object
    from outbox
    where
      id in (
        select object_id
        from game_objects
        where game_id = ${gameId}
      ) and
      has_fen = true
    order by created_at asc
  `;

exports.getRecentGames = pg =>
  q(pg)`
    -- get recent games
    select id, white_name, black_name, num_moves, updated_at
    from games
    where num_moves > 6
    order by updated_at desc
    limit 25
  `;

exports.getChallengeBoard = pg =>
  q(pg)`
    -- get challenge board
    select actor_id, actor_name
    from challenge_board
    order by bumped_at desc
    limit 50
  `;

exports.insertOrBumpChallengeBoard = (pg, actorId, actorName, now) =>
  q(pg)`
    -- try insert challenge board
    insert into challenge_board (actor_id, actor_name, bumped_at, created_at)
    values (${actorId}, ${actorName}, ${now}, ${now})
    on conflict (actor_id) do update set
      actor_name = ${actorName},
      bumped_at = ${now}
    returning created_at
  `;

exports.removeFromChallengeBoard = (pg, actorId) =>
  q(pg)`
    -- delete challenge board
    delete from challenge_board
    where actor_id = ${actorId}
  `;
