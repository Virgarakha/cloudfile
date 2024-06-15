import React, { useState, useEffect } from 'react';
import { openDB } from 'idb';

async function initDB() {
  const db = await openDB('fileDB', 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains('folders')) {
        const folderStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
  return db;
}

function App() {
  const [files, setFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [displayedFiles, setDisplayedFiles] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [db, setDb] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFile, setEditingFile] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  const [tempFileName, setTempFileName] = useState('');
  const [tempFolderName, setTempFolderName] = useState('');

  useEffect(() => {
    const init = async () => {
      const dbInstance = await initDB();
      setDb(dbInstance);
      const allFiles = await dbInstance.getAll('files');
      const allFolders = await dbInstance.getAll('folders');
      setUploadedFiles(allFiles);
      setFolders(allFolders);
      setDisplayedFiles(allFiles);  // Initially display all files
    };
    init();
  }, []);

  const handleFileChange = (event) => {
    setFiles([...event.target.files]);
  };

  const handleUpload = async () => {
    if (db && selectedFolder) {
      const newFiles = files.map(file => {
        return {
          name: file.name,
          url: URL.createObjectURL(file),
          file,
          folderId: selectedFolder
        };
      });

      for (const file of newFiles) {
        await db.put('files', file);
      }

      setUploadedFiles([...uploadedFiles, ...newFiles]);
      setDisplayedFiles([...displayedFiles, ...newFiles]);
    }
  };

  const handleDownload = async (fileName) => {
    if (db) {
      const fileRecord = await db.get('files', fileName);
      if (fileRecord) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(fileRecord.file);
        link.download = fileRecord.name;
        link.click();
      }
    }
  };

  const handleCreateFolder = async () => {
    if (db && newFolderName.trim()) {
      const newFolder = { name: newFolderName, createdAt: new Date().toISOString() };
      const id = await db.add('folders', newFolder);
      setFolders([...folders, { ...newFolder, id }]);
      setNewFolderName('');
    }
  };

  const handleRenameFolder = async (folderId, newName) => {
    if (db && newName.trim()) {
      const folder = await db.get('folders', folderId);
      folder.name = newName;
      await db.put('folders', folder);
      const updatedFolders = folders.map(f => f.id === folderId ? folder : f);
      setFolders(updatedFolders);
      setEditingFolder(null);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (db) {
      const allFiles = await db.getAll('files');
      const folderFiles = allFiles.filter(file => file.folderId === folderId);
      for (const file of folderFiles) {
        await db.delete('files', file.name);
      }
      await db.delete('folders', folderId);
      setFolders(folders.filter(f => f.id !== folderId));
      setUploadedFiles(uploadedFiles.filter(f => f.folderId !== folderId));
      setDisplayedFiles(displayedFiles.filter(f => f.folderId !== folderId));
    }
  };

  const handleDeleteFile = async (fileName) => {
    if (db) {
      await db.delete('files', fileName);
      setUploadedFiles(uploadedFiles.filter(file => file.name !== fileName));
      setDisplayedFiles(displayedFiles.filter(file => file.name !== fileName));
    }
  };

  const handleFolderDoubleClick = async (folderId) => {
    if (db) {
      const allFiles = await db.getAll('files');
      const folderFiles = allFiles.filter(file => file.folderId === folderId);
      setDisplayedFiles(folderFiles);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    const filteredFiles = uploadedFiles.filter(file => file.name.toLowerCase().includes(query));
    setDisplayedFiles(filteredFiles);
  };

  const handleCopyLink = (fileUrl) => {
    navigator.clipboard.writeText(fileUrl).then(() => {
      alert('Tautan file telah disalin ke clipboard!');
    }, (err) => {
      console.error('Gagal menyalin tautan: ', err);
    });
  };

  const handleEditFile = (fileName) => {
    setEditingFile(fileName);
    setTempFileName(fileName);
  };

  const handleEditFolder = (folderId) => {
    setEditingFolder(folderId);
    const folder = folders.find(f => f.id === folderId);
    setTempFolderName(folder.name);
  };

  const handleSaveFileName = async (oldFileName, newFileName) => {
    if (db && newFileName.trim() && oldFileName !== newFileName) {
      const file = await db.get('files', oldFileName);
      file.name = newFileName;
      await db.put('files', file);
      await db.delete('files', oldFileName);
      const updatedFiles = uploadedFiles.map(f => f.name === oldFileName ? file : f);
      setUploadedFiles(updatedFiles);
      setDisplayedFiles(updatedFiles.filter(file => file.folderId === selectedFolder || !selectedFolder));
      setEditingFile(null);
    }
  };

  const handleSaveFolderName = async (folderId) => {
    await handleRenameFolder(folderId, tempFolderName);
    setEditingFolder(null);
  };

  return (
    <div style={styles.container}>
      <h1>Nova Cloud</h1>
      <h3>Simpan Filemu Di sini!</h3>
      <div style={styles.uploadSection}>
        <input type="file" multiple onChange={handleFileChange} style={styles.fileInput} />
        <select onChange={(e) => setSelectedFolder(parseInt(e.target.value))} style={styles.select}>
          <option value="">Pilih Folder</option>
          {folders.map(folder => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
        <button onClick={handleUpload} style={styles.uploadButton}>Unggah</button>
      </div>
      <h2>Folder</h2>
      <div style={styles.folderSection}>
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Nama Folder Baru"
          style={styles.folderInput}
        />
        <button onClick={handleCreateFolder} style={styles.createButton}>Buat Folder</button>
      </div>
      <ul style={styles.folderList}>
        {folders.map(folder => (
          <li key={folder.id} style={styles.folderItem} onDoubleClick={() => handleFolderDoubleClick(folder.id)}>
            {editingFolder === folder.id ? (
              <>
                <input
                  type="text"
                  value={tempFolderName}
                  onChange={(e) => setTempFolderName(e.target.value)}
                  style={styles.folderNameInput}
                />
                <button onClick={() => handleSaveFolderName(folder.id)} style={styles.saveButton}>Simpan</button>
              </>
            ) : (
              <>
                <span onClick={() => handleEditFolder(folder.id)}>{folder.name}</span>
                <span style={styles.folderDate}>{new Date(folder.createdAt).toLocaleString()}</span>
                <button onClick={() => handleDeleteFolder(folder.id)} style={styles.deleteButton}>Hapus</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <h2>Berkas yang Diunggah</h2>
      <input
        type="text"
        value={searchQuery}
        onChange={handleSearch}
        placeholder="Cari Berkas"
        style={styles.searchInput}
      />
      <ul style={styles.fileList}>
        {displayedFiles.map((file, index) => (
          <li key={index} style={styles.fileItem}>
            {editingFile === file.name ? (
              <>
                <input
                  type="text"
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  style={styles.fileNameInput}
                />
                <button onClick={() => handleSaveFileName(file.name, tempFileName)} style={styles.saveButton}>Simpan</button>
              </>
            ) : (
              <>
                <span onClick={() => handleEditFile(file.name)}>{file.name}</span>
                (Folder: {folders.find(f => f.id === file.folderId)?.name || 'Tanpa Folder'})
                <button onClick={() => handleDownload(file.name)} style={styles.downloadButton}>Unduh</button>
                <button onClick={() => handleDeleteFile(file.name)} style={styles.deleteButton}>Hapus</button>
                <button onClick={() => handleCopyLink(file.url)} style={styles.copyLinkButton}>Salin Tautan</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '800px',
    margin: 'auto'
  },
  uploadSection: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px'
  },
  fileInput: {
    flex: 1,
    marginRight: '10px'
  },
  select: {
    flex: 1,
    marginRight: '10px'
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    cursor: 'pointer'
  },
  folderSection: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px'
  },
  folderInput: {
    flex: 1,
    marginRight: '10px'
  },
  createButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    cursor: 'pointer'
  },
  folderList: {
    listStyleType: 'none',
    padding: 0
  },
  folderItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    border: '1px solid #ddd',
    cursor: 'pointer'
  },
  folderNameInput: {
    flex: 1,
    marginRight: '10px'
  },
  folderDate: {
    marginRight: '10px'
  },
  deleteButton: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    cursor: 'pointer'
  },
  searchInput: {
    width: '100%',
    padding: '10px',
    marginBottom: '20px',
    boxSizing: 'border-box'
  },
  fileList: {
    listStyleType: 'none',
    padding: 0
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    border: '1px solid #ddd'
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    cursor: 'pointer',
    marginLeft: '10px'
  },
  copyLinkButton: {
    backgroundColor: '#FFC107',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    cursor: 'pointer',
    marginLeft: '10px'
  },
  fileNameInput: {
    flex: 1,
    marginRight: '10px'
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    cursor: 'pointer',
    marginLeft: '10px'
  }
};

export default App;
