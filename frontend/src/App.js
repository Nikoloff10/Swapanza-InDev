import React from 'react';
import UserList from './components/UserList'; 
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
function App() {
  return (
    <div className="App">
      <UserList />
      <LoginForm />
      <RegistrationForm />
    </div>
  );
}

export default App;
