use redis::AsyncCommands;

const QUEUE_KEY: &str = "scrape:queue";

pub async fn enqueue(
    conn: &mut redis::aio::MultiplexedConnection,
    task_id: &str,
) -> Result<(), redis::RedisError> {
    conn.lpush(QUEUE_KEY, task_id).await
}

pub async fn dequeue(
    redis_url: &str,
) -> Result<String, redis::RedisError> {
    // BRPOP needs its own connection since it blocks
    let client = redis::Client::open(redis_url)?;
    let mut conn = client.get_multiplexed_async_connection().await?;
    let result: (String, String) = redis::cmd("BRPOP")
        .arg(QUEUE_KEY)
        .arg(0) // block indefinitely
        .query_async(&mut conn)
        .await?;
    Ok(result.1) // result is (key, value)
}

pub async fn queue_length(conn: &mut redis::aio::MultiplexedConnection) -> Result<i64, redis::RedisError> {
    conn.llen(QUEUE_KEY).await
}

pub async fn ping(conn: &mut redis::aio::MultiplexedConnection) -> Result<bool, redis::RedisError> {
    let result: String = redis::cmd("PING").query_async(conn).await?;
    Ok(result == "PONG")
}
