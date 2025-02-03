import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_URL 

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null);   

  useEffect(() => {
    const fetchUsers = async () => { 
      try {
        const response = await axios.get(`${apiUrl}/api/users/`);
        setUsers(response.data);
      } catch (error) {
        console.error(error);
        setError(error); 
      } finally {
        setLoading(false); 
      }
    };

    fetchUsers();
  }, []); 

  if (loading) {
    return <div>Loading users...</div>; 
  }

  if (error) {
    return <div>Error: {error.message}</div>; 
  }

  return (
    <div>
      <h2>Users</h2>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.username}</li>
        ))}
      </ul>
    </div>
  );
}

export default UserList;