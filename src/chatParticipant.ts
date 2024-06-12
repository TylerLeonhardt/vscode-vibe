import { ChatRequestHandler, JSONSchema, LanguageModelChat, LanguageModelChatFunction, LanguageModelChatMessage, LanguageModelChatResponseFunctionUsePart, lm } from "vscode";
import { SpotifyAuthProvider } from "./authProvider";
import { RecommendationsRequest, SpotifyApi, Track } from "@spotify/web-api-ts-sdk";

const tools: LanguageModelChatFunction[] = [{
    name: "get_recommendations",
    description: "Call Spotify's API to get track recommendations",
    parametersSchema: {
        "type": "object",
        "properties": {
            "seed_genres": {
                "type": "array",
                "description": "The ONLY VALID seed genres to choose from",
                "items": {
                    "type": "string",
                    "enum": [
                        "acoustic",
                        "afrobeat",
                        "alt-rock",
                        "alternative",
                        "ambient",
                        "anime",
                        "black-metal",
                        "bluegrass",
                        "blues",
                        "bossanova",
                        "brazil",
                        "breakbeat",
                        "british",
                        "cantopop",
                        "chicago-house",
                        "children",
                        "chill",
                        "classical",
                        "club",
                        "comedy",
                        "country",
                        "dance",
                        "dancehall",
                        "death-metal",
                        "deep-house",
                        "detroit-techno",
                        "disco",
                        "disney",
                        "drum-and-bass",
                        "dub",
                        "dubstep",
                        "edm",
                        "electro",
                        "electronic",
                        "emo",
                        "folk",
                        "forro",
                        "french",
                        "funk",
                        "garage",
                        "german",
                        "gospel",
                        "goth",
                        "grindcore",
                        "groove",
                        "grunge",
                        "guitar",
                        "happy",
                        "hard-rock",
                        "hardcore",
                        "hardstyle",
                        "heavy-metal",
                        "hip-hop",
                        "holidays",
                        "honky-tonk",
                        "house",
                        "idm",
                        "indian",
                        "indie",
                        "indie-pop",
                        "industrial",
                        "iranian",
                        "j-dance",
                        "j-idol",
                        "j-pop",
                        "j-rock",
                        "jazz",
                        "k-pop",
                        "kids",
                        "latin",
                        "latino",
                        "malay",
                        "mandopop",
                        "metal",
                        "metal-misc",
                        "metalcore",
                        "minimal-techno",
                        "movies",
                        "mpb",
                        "new-age",
                        "new-release",
                        "opera",
                        "pagode",
                        "party",
                        "philippines-opm",
                        "piano",
                        "pop",
                        "pop-film",
                        "post-dubstep",
                        "power-pop",
                        "progressive-house",
                        "psych-rock",
                        "punk",
                        "punk-rock",
                        "r-n-b",
                        "rainy-day",
                        "reggae",
                        "reggaeton",
                        "road-trip",
                        "rock",
                        "rock-n-roll",
                        "rockabilly",
                        "romance",
                        "sad",
                        "salsa",
                        "samba",
                        "sertanejo",
                        "show-tunes",
                        "singer-songwriter",
                        "ska",
                        "sleep",
                        "songwriter",
                        "soul",
                        "soundtracks",
                        "spanish",
                        "study",
                        "summer",
                        "swedish",
                        "synth-pop",
                        "tango",
                        "techno",
                        "trance",
                        "trip-hop",
                        "turkish",
                        "work-out",
                        "world-music"
                    ]
                }
            },
            "min_acousticness": {
                "type": "integer"
            },
            "max_acousticness": {
                "type": "integer"
            },
            "min_danceability": {
                "type": "integer"
            },
            "max_danceability": {
                "type": "integer"
            },
            "min_energy": {
                "type": "integer"
            },
            "max_energy": {
                "type": "integer"
            },
            "min_instrumentalness": {
                "type": "integer"
            },
            "max_instrumentalness": {
                "type": "integer"
            },
            "min_liveness": {
                "type": "integer"
            },
            "max_liveness": {
                "type": "integer"
            },
            "min_loudness": {
                "type": "integer"
            },
            "max_loudness": {
                "type": "integer"
            },
            "min_popularity": {
                "type": "integer"
            },
            "max_popularity": {
                "type": "integer"
            },
            "min_speechiness": {
                "type": "integer"
            },
            "max_speechiness": {
                "type": "integer"
            },
            "min_tempo": {
                "type": "integer"
            },
            "max_tempo": {
                "type": "integer"
            },
            "min_valence": {
                "type": "integer"
            },
            "max_valence": {
                "type": "integer"
            }
        },
        "required": [
            "seed_genre"
        ]
    }
}];

export class SpotifyChatResponseHandler {
    constructor(private readonly _authProvider: SpotifyAuthProvider) {}

    handle: ChatRequestHandler = async (request, _context, response) => {
        const client = await this._authProvider.getSpotifyClient();
        const models = await lm.selectChatModels({ family: 'gpt-4' });
        const [model] = models;

        response.progress('Asking Copilot to generate recommendation criteria...');
        const modelResponse = await model.sendRequest(
            [
                LanguageModelChatMessage.Assistant(`Create a function call of the get_recommendations function that would is perfectly inspired by the user provided message.
Make sure to include seed_genres that are valid based on the enum.
Make sure to include a few other properties that are valid based on the schema.
If you specify a min value for a property, you should also specify a max value for that property.
If you specify a max value for a property, you should also specify a min value for that property.
`),
                LanguageModelChatMessage.User(request.prompt)
            ],
            { tools }
        );
        for await (const chunk of modelResponse.stream) {
            // TODO: Handle other types of chunks
            if (chunk instanceof LanguageModelChatResponseFunctionUsePart) {
                response.progress('Asking Spotify for recommendations...');
                // TODO: Handle bad function calls
                const recommendations = await this.getRecommendations(client, JSON.parse(chunk.parameters));
                // TODO: Handle no recommendations
                response.markdown(this._formatTracksToMarkdownList(recommendations.tracks));
                response.button({
                    command: 'vscode-vibe.play-songs',
                    title: 'Play Songs',
                    arguments: [recommendations.tracks.map(track => track.uri)],
                    tooltip: 'Play the recommended songs'
                });
                return;
            }
        }
    };

    private getRecommendations(client: SpotifyApi, request: RecommendationsRequest, genres?: string[]) {
        return client.recommendations.get({
            ...request,
            limit: 10
        });
    }

    private _formatTracksToMarkdownList(recommendations: Track[]) {
        // TODO: Make this look better
        return recommendations.map(track => `- [${track.name}](${track.external_urls.spotify}) by ${track.artists.map(artist => artist.name).join(', ')}`).join('\n');
    }
}
