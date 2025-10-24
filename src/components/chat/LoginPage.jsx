import React from "react";

const LoginPage = () => {

    const googleLogin = () => {
        window.location.href = "http://localhost:8080/oauth2/authorization/google";
    };

    const githubLogin = () => {
        window.location.href = "http://localhost:8080/oauth2/authorization/github";
    };

    return (
        <div className="container">
            <h2 className="text-center mb-5">Welcome to OAuth Login</h2>
            <div className="flex justify-center container">
                <button className="bg-blue-500 p-3 mr-5" onClick={googleLogin}>Login with Google</button>
                <button className="bg-green-500 p-3" onClick={githubLogin}>Login with Github</button>
            </div>
        </div>
    )
}

export default LoginPage;