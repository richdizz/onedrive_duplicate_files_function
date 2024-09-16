// MyAuthenticationProvider.ts
import { AuthenticationProvider } from "@microsoft/microsoft-graph-client";

class CustomAuthProvider implements AuthenticationProvider {
    private token: string;

    // Constructor that accepts the token
    constructor(token: string) {
        this.token = token;
    }
	public async getAccessToken(): Promise<string> {
        return this.token;
    }
}

export default CustomAuthProvider;