import { EventConfig, StepHandler } from "@motiadev/core";
import { z } from "zod";
import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { FeedType, FilterType } from "@neynar/nodejs-sdk/build/api/index.js";
import { CronConfig } from "@motiadev/core";
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
  throw new Error("Neynar API Key is not set in environment variables");
}




 
export const config: CronConfig = {
  type: 'cron' as const,
  name: 'PeriodicJob',
  description: 'Runs every minute and emits a timestamp',
  cron: '* * * * *', // run every hour at minute 0
  emits: ['cron-ticked', 'cast.received'],
  flows: ['farcaster'],
}


// Initialize Neynar client
export const cccnfig: EventConfig = {
  type: "event",
  name: "Farcaster Trending Stream",
  subscribes: ["cast.stream.start"],
  emits: ["cast.received", "tweet.received"],
  input: z.object({
    keywords: z
      .array(z.string())
      .default([
        "AI",
        "artificial intelligence",
        "machine learning",
        "the",
        "my",
        "gm",
        "gn",
        "and",
      ]),
    limit: z.number().default(3),
  }),
  flows: ["farcaster"],
};

export const handler: StepHandler<typeof config> = async ({emit,logger,state}) => {
  //const { emit } = context;
  //onst { keywords, limit } = input;
  const neynarConfig = new Configuration({
    apiKey: NEYNAR_API_KEY,
  });
  const client = new NeynarAPIClient(neynarConfig);

  const fetchTrendingCasts = async () => {
    try {
      console.log("Fetching trending casts with params:", {
        feedType: FeedType.Filter,
        filterType: FilterType.GlobalTrending,
        //limit,
      });

      // Fetch trending casts
      const feed = await client.fetchFeed({
        feedType: FeedType.Filter,
        filterType: FilterType.GlobalTrending,
        limit: 10,
      });

      //console.log('Raw feed response:', JSON.stringify(feed, null, 2));

      if (!feed.casts || feed.casts.length === 0) {
        console.log("No casts found in the feed");
        return;
      }

      console.log(`Found ${feed.casts.length} casts`);
      let batch = [];
      // Process each cast
      for (const cast of feed.casts) {
        console.log("Processing cast:", {
          hash: cast.hash,
          text: cast.text,
          author: cast.author.username,
        });

        // Check if cast text contains any of our keywords
        /*   const containsKeyword = keywords.some((keyword: string) => 
          cast.text.toLowerCase().includes(keyword.toLowerCase())
        );

        if (containsKeyword) { */
        const castData = {
          id: cast.hash,
          text: cast.text,
          created_at: cast.timestamp,
          author: {
            username: cast.author.username,
            display_name: cast.author.display_name,
            fid: cast.author.fid,
            pfp_url: cast.author.pfp_url,
            follower_count: cast.author.follower_count,
            following_count: cast.author.following_count,
            verified_addresses: cast.author.verified_addresses,
          },
          reactions: {
            likes_count: cast.reactions.likes_count,
            recasts_count: cast.reactions.recasts_count,
            likes: cast.reactions.likes,
            recasts: cast.reactions.recasts,
          },
          replies: cast.replies,
          channel: cast.channel,
          embeds: cast.embeds,
        };

        console.log("Found matching cast:", {
          id: castData.id,
          text: castData.text,
          author: castData.author.username,
          reactions: castData.reactions,
        });

        batch.push(castData);

      }

      if (batch.length > 3) {
        emit({
          topic: "cast.received",
          data: { casts: batch },
        });
      }
      return feed.next?.cursor;
    } catch (error) {
      console.log("Error in fetchTrendingCasts:", {
        error,
      });
      return undefined;
    }
  };

  // Initial fetch
  let nextCursor = await fetchTrendingCasts();

/*   // Set up polling every 30 seconds
  const pollInterval = setInterval(async () => {
    console.log("Polling for new casts...");
    if (nextCursor) {
      nextCursor = await fetchTrendingCasts();
      console.log("Next cursor:", nextCursor);
    } else {
      nextCursor = await fetchTrendingCasts();
      console.log("No next cursor, fetching again...");
    }
  }, 30000); */

  // Cleanup on process exit
  process.on("SIGINT", () => {
    console.log("Stopping Farcaster trending stream...");
   //clearInterval(pollInterval);
    process.exit(0);
  });
};
