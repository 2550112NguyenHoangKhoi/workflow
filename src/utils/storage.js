/**
 * Helper to manage local files in localStorage
 */

const STORAGE_KEY = 'workflow_local_files';

export const getLocalFiles = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get local files', error);
    return [];
  }
};

export const saveLocalFile = (file) => {
  try {
    const files = getLocalFiles();
    const newFile = {
      id: 'local_' + Date.now().toString(),
      name: file.name,
      type: file.name.endsWith('.md') ? 'md' : 'txt',
      date: new Date().toLocaleDateString(),
      size: (file.size / 1024).toFixed(1) + ' KB',
      content: file.content
    };
    
    files.push(newFile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    return newFile;
  } catch (error) {
    console.error('Failed to save local file', error);
    return null;
  }
};

export const deleteLocalFile = (id) => {
  try {
    let files = getLocalFiles();
    files = files.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    return true;
  } catch (error) {
    console.error('Failed to delete local file', error);
    return false;
  }
};

export const getLocalFile = (id) => {
  const files = getLocalFiles();
  return files.find(f => f.id === id);
};
