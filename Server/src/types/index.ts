export type { DataEnvelope, DataListEnvelope, PagingRequest } from "./dataEnvelopes";

export type UserProfile = {
	id: string;
	displayName: string;
	email: string;
	rating: number;
	gamesPlayed: number;
	wins: number;
	losses: number;
};

export type Friend = {
	id: string;
	displayName: string;
	status: "online" | "offline" | "in-game";
};
