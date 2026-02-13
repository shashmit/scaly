import { Request, Response, NextFunction } from "express";
import { ClerkExpressRequireAuth, StrictAuthProp, createClerkClient } from "@clerk/clerk-sdk-node";
import { convexClient } from "../lib/convex";
import { api } from "../../../../convex/_generated/api";
import { ApiError } from "./errorHandler";

declare global {
  namespace Express {
    interface Request extends StrictAuthProp {}
  }
}

export interface UserRequest extends Request {
  userId?: string; // Convex User ID (Id<"users">)
  clerkUserId?: string; // Clerk User ID
}

const requireAuth = ClerkExpressRequireAuth();
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const extractContext = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // req.auth is populated by ClerkExpressRequireAuth
    const { userId: clerkUserId } = req.auth;

    if (!clerkUserId) {
      return next(new ApiError(401, "Unauthenticated"));
    }

    // Resolve Clerk User ID to Convex User ID
    let user = await convexClient.query(api.users.getByClerkId, {
      clerkUserId,
    });

    if (!user) {
      // Fallback: If user missing, fetch from Clerk and sync (Development/Robustness)
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        const name = `${clerkUser.firstName} ${clerkUser.lastName}`.trim();
        const email = clerkUser.emailAddresses[0]?.emailAddress || "";

        await convexClient.mutation(api.users.syncUser, {
          clerkUserId,
          name,
          email,
        });

        // Fetch again after sync
        user = await convexClient.query(api.users.getByClerkId, {
          clerkUserId,
        });
      } catch (syncError) {
        console.error("Failed to sync user from Clerk:", syncError);
        // Continue to 404 if sync failed
      }
    }

    if (!user) {
      return next(new ApiError(404, "User not found in database. Ensure webhook sync is working."));
    }

    req.userId = user._id;
    req.clerkUserId = clerkUserId;
    
    next();
  } catch (err) {
    next(err);
  }
};

export const validateUserContext = [requireAuth, extractContext];
