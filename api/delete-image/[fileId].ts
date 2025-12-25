import React from 'react';

const ImageCard = ({ imageName }) => {
  
  const handleDelete = async () => {
    // Optional: Add a confirmation dialog
    if (!window.confirm(`Are you sure you want to delete ${imageName}?`)) return;

    try {
      const response = await fetch('/api/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: imageName }) // Pass the dynamic name here
      });
      
      const result = await response.json();

      if (result.success) {
        alert('Deleted successfully!');
        // Refresh your list or remove the item from state here
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  return (
    <div className="border p-4">
      <img src={`https://.../${imageName}`} alt="Drive content" />
      <button 
        onClick={handleDelete}
        className="bg-red-500 text-white px-4 py-2 mt-2"
      >
        Delete Image
      </button>
    </div>
  );
};

export default ImageCard;
