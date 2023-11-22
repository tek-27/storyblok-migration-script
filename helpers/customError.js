function CustomError(message, status, response) {
    const error = new Error(message);
    error.status = status || 500;
    error.response = response || "Something went wrong";
    return error;
}