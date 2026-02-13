"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import CurrencyConverter from "currency-converter-lt";

// Action to fetch rates from external API using NPM package
export const fetchRates = action({
  args: {},
  handler: async (ctx) => {
    try {
      const converter = new CurrencyConverter({ from: "USD" });
      const rates = await converter.rates();
      
      if (!rates) {
        throw new Error("Failed to fetch rates from package");
      }
      
      const date = new Date().toISOString().split('T')[0];
      
      await ctx.runMutation(internal.rates.updateRates, {
        base: "USD",
        rates: rates,
        date: date,
      });
      
      return { success: true, date: date, count: Object.keys(rates).length };
    } catch (error: any) {
      console.error("Error fetching exchange rates:", error);
      return { success: false, error: error.message };
    }
  },
});
